/**
 * سرویس AutoUpdater برای بررسی نسخه در پس‌زمینه و جایگزینی امن فایل اجرایی
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  GITHUB_LATEST_YML_URL,
  GITHUB_LATEST_API_URL,
  compareSemver,
  parseLatestYmlVersion,
  buildPortableAssetUrl,
  isValidPeHeader,
  buildPortableReplaceScript,
} = require('./update-utils.cjs');

class AutoUpdater {
  /**
   * @param {{
   *   app: Electron.App,
   *   dialog: Electron.Dialog,
   *   shell: Electron.Shell,
   *   session: Electron.Session,
   *   getMainWindow: () => Electron.BrowserWindow | null,
   *   shutdown: () => Promise<void>,
   *   onExitApp: (code: number) => void,
   *   log?: (...parts: unknown[]) => void,
   *   onStateChange?: (state: Record<string, unknown>) => void,
   * }} options
   */
  constructor(options) {
    this.app = options.app;
    this.dialog = options.dialog;
    this.shell = options.shell;
    this.session = options.session;
    this.getMainWindow = options.getMainWindow;
    this.shutdown = options.shutdown;
    this.onExitApp = options.onExitApp;
    this.log = options.log || (() => {});
    this.onStateChange = options.onStateChange || (() => {});

    this.isDev = !this.app.isPackaged;
    this.portableExePath = process.env.PORTABLE_EXECUTABLE_FILE || '';
    this.isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || this.portableExePath);
    this.canReplacePortableExe = Boolean(
      this.isPortable &&
        this.portableExePath &&
        process.platform === 'win32' &&
        fs.existsSync(this.portableExePath),
    );

    this.electronUpdater = null;
    this.controller = null;
    this.pollingTimer = null;
    this.manualCheckRequested = false;
    this.isDownloading = false;
    this.isInstalling = false;
    this.downloadedInstallerPath = null;
    this.downloadedVersion = null;

    this.state = {
      status: this.isDev ? 'unsupported' : 'idle',
      currentVersion: this.app.getVersion(),
      isPortable: this.isPortable,
      canSelfUpdate: !this.isDev && (!this.isPortable || this.canReplacePortableExe),
    };
  }

  getState() {
    return this.state;
  }

  setState(patch) {
    this.state = {
      ...this.state,
      ...patch,
      currentVersion: this.app.getVersion(),
      isPortable: this.isPortable,
      canSelfUpdate: !this.isDev && (!this.isPortable || this.canReplacePortableExe),
    };
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:state-changed', this.state);
    }
    this.onStateChange(this.state);
    return this.state;
  }

  formatError(err) {
    const raw = err?.message || String(err || '');
    const isMissingReleaseOrPrivate =
      raw.includes('404') ||
      raw.includes('ERR_UPDATER_LATEST_VERSION_NOT_FOUND') ||
      raw.includes('ERR_UPDATER_NO_PUBLISHED_VERSIONS') ||
      raw.includes('ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') ||
      raw.includes('No published versions') ||
      raw.includes('Cannot find latest.yml');

    if (isMissingReleaseOrPrivate) {
      return 'در گیت‌هاب نسخه قابل دریافت پیدا نشد (مطمئن شوید مخزن عمومی است و Release جدید همراه latest.yml منتشر شده باشد).';
    }
    return 'اتصال به گیت‌هاب برقرار نشد. اتصال اینترنت را بررسی کنید.';
  }

  verifyExecutableFile(filePath) {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, reason: 'فایل پیدا نشد' };
      }
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size < 10 * 1024 * 1024) {
        return { ok: false, reason: 'حجم فایل دانلودشده ناقص است' };
      }
      const header = Buffer.alloc(2);
      const fd = fs.openSync(filePath, 'r');
      try {
        fs.readSync(fd, header, 0, 2, 0);
      } finally {
        fs.closeSync(fd);
      }
      if (!isValidPeHeader(header)) {
        return { ok: false, reason: 'ساختار فایل اجرایی معتبر نیست' };
      }
      return { ok: true, size: stat.size };
    } catch (err) {
      return { ok: false, reason: err?.message || String(err) };
    }
  }

  portableUpdatesDir() {
    const dir = path.join(this.app.getPath('userData'), 'updates');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  cleanupStaleCache() {
    const currentVersion = this.app.getVersion();
    try {
      const dir = path.join(this.app.getPath('userData'), 'updates');
      if (fs.existsSync(dir)) {
        for (const entry of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, entry);
          if (entry.endsWith('.download') || entry.endsWith('.tmp')) {
            fs.rmSync(fullPath, { force: true });
            continue;
          }
          const match = entry.match(/AghrinPishFactor-Portable-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.exe$/i);
          if (match && compareSemver(match[1], currentVersion) <= 0) {
            fs.rmSync(fullPath, { force: true });
          }
        }
      }
    } catch (err) {
      this.log('خطا در پاک‌سازی کش آپدیت پرتابل:', err?.message || String(err));
    }

    try {
      const localAppData = process.env.LOCALAPPDATA || this.app.getPath('appData');
      const pendingDir = path.join(localAppData, 'pish-factor-updater', 'pending');
      if (fs.existsSync(pendingDir)) {
        for (const entry of fs.readdirSync(pendingDir)) {
          const match = entry.match(/AghrinPishFactor-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.exe$/i);
          if (match && compareSemver(match[1], currentVersion) <= 0) {
            fs.rmSync(pendingDir, { recursive: true, force: true });
            this.log('کش قدیمی نصب‌کننده پاک‌سازی شد:', entry);
            break;
          }
        }
      }
    } catch (err) {
      this.log('خطا در پاک‌سازی کش نصب‌کننده:', err?.message || String(err));
    }
  }

  spawnDetachedAndVerify(command, args, extraOptions = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        const child = spawn(command, args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: extraOptions.windowsHide ?? false,
          env: extraOptions.env || process.env,
        });
        child.once('error', (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
        child.once('spawn', () => {
          if (settled) return;
          settled = true;
          try {
            child.unref();
          } catch {
            /* ignore */
          }
          resolve(true);
        });
        setTimeout(() => {
          if (settled) return;
          if (child.pid) {
            settled = true;
            try {
              child.unref();
            } catch {
              /* ignore */
            }
            resolve(true);
          }
        }, 600);
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  }

  async launchDownloadedInstaller(installerPath) {
    const args = ['--updated', '--force-run'];
    try {
      await this.spawnDetachedAndVerify(installerPath, args);
      return { ok: true, method: 'spawn' };
    } catch (spawnErr) {
      this.log(
        'اجرای مستقیم نصب‌کننده با خطا مواجه شد، تلاش با دسترسی مدیر:',
        spawnErr?.code || spawnErr?.message || String(spawnErr),
      );
    }

    const elevateExe = path.join(process.resourcesPath, 'elevate.exe');
    if (fs.existsSync(elevateExe)) {
      try {
        await this.spawnDetachedAndVerify(elevateExe, [installerPath, ...args]);
        return { ok: true, method: 'elevate' };
      } catch (elevateErr) {
        this.log(
          'اجرا با elevate.exe انجام نشد:',
          elevateErr?.code || elevateErr?.message || String(elevateErr),
        );
      }
    }

    try {
      const openError = await this.shell.openPath(installerPath);
      if (!openError) {
        return { ok: true, method: 'shell.openPath' };
      }
      this.log('shell.openPath خطا داد:', openError);
      return { ok: false, error: openError };
    } catch (openErr) {
      const msg = openErr?.message || String(openErr);
      this.log('خطا در shell.openPath:', msg);
      return { ok: false, error: msg };
    }
  }

  async fetchRemoteLatestVersion() {
    const updaterSession = this.session.fromPartition('electron-updater');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await updaterSession.fetch(GITHUB_LATEST_YML_URL, {
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'Aghrin-PishFactor',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const yaml = await res.text();
        const ver = parseLatestYmlVersion(yaml);
        if (ver) return ver;
      }

      const apiRes = await updaterSession.fetch(GITHUB_LATEST_API_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'Cache-Control': 'no-cache',
          'User-Agent': 'Aghrin-PishFactor',
        },
        signal: controller.signal,
      });
      if (!apiRes.ok) {
        throw new Error(`HTTP ${apiRes.status}`);
      }
      const json = await apiRes.json();
      const ver = parseLatestYmlVersion(`version: ${String(json?.tag_name || '')}`);
      if (!ver) {
        throw new Error('ERR_UPDATER_LATEST_VERSION_NOT_FOUND');
      }
      return ver;
    } finally {
      clearTimeout(timer);
    }
  }

  async resolvePortableDownloadUrl(targetVersion) {
    const fallbackUrl = buildPortableAssetUrl(targetVersion);
    const updaterSession = this.session.fromPartition('electron-updater');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const tag = `v${String(targetVersion).replace(/^v/i, '')}`;
      const res = await updaterSession.fetch(
        `https://api.github.com/repos/agrin111/pish-factor-/releases/tags/${encodeURIComponent(tag)}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Aghrin-PishFactor',
          },
          signal: controller.signal,
        },
      );
      if (!res.ok) return fallbackUrl;
      const data = await res.json();
      const assets = Array.isArray(data?.assets) ? data.assets : [];
      const portableAsset = assets.find(
        (item) =>
          typeof item?.name === 'string' &&
          item.name.toLowerCase().includes('portable') &&
          item.name.toLowerCase().endsWith('.exe') &&
          typeof item?.browser_download_url === 'string',
      );
      return portableAsset?.browser_download_url || fallbackUrl;
    } catch {
      return fallbackUrl;
    } finally {
      clearTimeout(timer);
    }
  }

  async promptConfirmInstallDialog(versionLabel, portableMode) {
    const win = this.getMainWindow();
    if (!win || win.isDestroyed()) return;
    const { response } = await this.dialog.showMessageBox(win, {
      type: 'info',
      title: 'نسخه جدید آماده جایگزینی است',
      message: portableMode
        ? `فایل اجرایی نسخه جدید (${versionLabel}) دریافت و تأیید شد.`
        : `نسخه جدید Aghrin PishFactor (${versionLabel}) دریافت شد.`,
      detail: portableMode
        ? 'با تأیید شما، برنامه بسته شده، فقط فایل اجرایی جایگزین می‌شود و نسخه جدید به‌صورت خودکار باز می‌گردد.\nتمام اطلاعات شما (پیش‌فاکتورها، مشتریان و تنظیمات) حفظ می‌شود.'
        : 'تمام اطلاعات شما (پیش‌فاکتورها، مشتریان و تنظیمات) حفظ می‌شود.\nبرای نصب، برنامه بسته شده و پنجره نصب نسخه جدید باز می‌شود.',
      buttons: [portableMode ? 'جایگزینی و راه‌اندازی مجدد' : 'نصب و راه‌اندازی مجدد', 'بعداً'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      await this.installUpdate();
    }
  }

  async installPortableExecutableUpdate(newExePath) {
    const check = this.verifyExecutableFile(newExePath);
    if (!check.ok) {
      this.log('فایل اجرایی نسخه جدید معتبر نبود:', check.reason);
      this.setState({
        status: 'error',
        message: `فایل اجرایی نسخه جدید معتبر نیست (${check.reason}).`,
      });
      this.dialog.showErrorBox(
        'فایل نسخه جدید معتبر نیست',
        `امکان جایگزینی فایل اجرایی وجود ندارد (${check.reason}). نسخه فعلی دست‌نخورده باقی ماند.`,
      );
      return;
    }

    if (this.downloadedVersion && compareSemver(this.downloadedVersion, this.app.getVersion()) <= 0) {
      this.log('تلاش برای جایگزینی با نسخه هم‌تراز یا قدیمی‌تر متوقف شد:', this.downloadedVersion);
      this.setState({
        status: 'up-to-date',
        message: 'نسخه فعلی به‌روز است و نیازی به جایگزینی ندارد.',
      });
      return;
    }

    try {
      fs.accessSync(path.dirname(this.portableExePath), fs.constants.W_OK);
    } catch {
      this.dialog.showErrorBox(
        'دسترسی نوشتن در پوشه برنامه وجود ندارد',
        `پوشه محل قرارگیری برنامه اجازه جایگزینی فایل اجرایی را ندارد:\n${path.dirname(this.portableExePath)}\n\nفایل برنامه را به دسکتاپ یا پوشه Documents منتقل کنید یا نسخه جدید را دستی جایگزین نمایید.`,
      );
      return;
    }

    this.isInstalling = true;
    this.setState({
      status: 'downloaded',
      message: 'در حال بستن سرور داخلی و جایگزینی امن فایل اجرایی...',
    });
    this.log('شروع جایگزینی فایل اجرایی پرتابل:', this.portableExePath, '<-', newExePath);

    const scriptPath = path.join(os.tmpdir(), `aghrin-replace-${process.pid}.ps1`);
    try {
      await this.shutdown();
      if (process.platform === 'win32') {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      fs.writeFileSync(scriptPath, `\uFEFF${buildPortableReplaceScript()}`, 'utf8');

      const systemRoot = process.env.SystemRoot || 'C:\\Windows';
      const powershellExe = path.join(
        systemRoot,
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      );
      const psCommand = fs.existsSync(powershellExe) ? powershellExe : 'powershell.exe';

      await this.spawnDetachedAndVerify(
        psCommand,
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-WindowStyle',
          'Hidden',
          '-File',
          scriptPath,
        ],
        {
          windowsHide: true,
          env: {
            ...process.env,
            AGHRIN_OLD_PID: String(process.pid),
            AGHRIN_TARGET_EXE: this.portableExePath,
            AGHRIN_NEW_EXE: newExePath,
            AGHRIN_BACKUP_EXE: `${this.portableExePath}.bak`,
          },
        },
      );

      this.log('اسکریپت جایگزینی فایل اجرایی اجرا شد؛ خروج از نسخه فعلی...');
      setTimeout(() => {
        this.onExitApp(0);
      }, 200);
    } catch (err) {
      this.isInstalling = false;
      try {
        fs.rmSync(scriptPath, { force: true });
      } catch {
        /* ignore */
      }
      this.log('خطا در اجرای جایگزینی فایل اجرایی:', err?.message || String(err));
      this.dialog.showErrorBox(
        'جایگزینی فایل اجرایی انجام نشد',
        `امکان جایگزینی خودکار نبود و نسخه فعلی بدون تغییر باقی ماند.\nمی‌توانید فایل جدید را از مسیر زیر اجرا کنید:\n${newExePath}`,
      );
    }
  }

  async installUpdate() {
    if (this.isInstalling) return;

    if (this.isPortable && this.canReplacePortableExe) {
      const targetNewExe = this.downloadedInstallerPath;
      if (!targetNewExe || !fs.existsSync(targetNewExe)) {
        this.log('فایل اجرایی نسخه جدید پیدا نشد:', targetNewExe || '(خالی)');
        this.setState({
          status: 'error',
          message: 'فایل اجرایی نسخه جدید پیدا نشد. لطفاً دوباره بررسی و دریافت کنید.',
        });
        return;
      }
      await this.installPortableExecutableUpdate(targetNewExe);
      return;
    }

    if (!this.electronUpdater) return;
    const installerPath = this.downloadedInstallerPath || this.electronUpdater.installerPath;
    const exeCheck = this.verifyExecutableFile(installerPath);
    if (!installerPath || !exeCheck.ok) {
      this.log(
        'فایل نصب‌کننده نسخه جدید پیدا نشد یا معتبر نیست:',
        installerPath || '(خالی)',
        exeCheck.reason || '',
      );
      this.setState({
        status: 'error',
        message: 'فایل نصب‌کننده نسخه جدید در سیستم پیدا نشد یا ناقص است. لطفاً دوباره دریافت کنید.',
      });
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        this.dialog.showErrorBox(
          'فایل نصب‌کننده پیدا نشد',
          'فایل نصب نسخه جدید یافت نشد یا ناقص است. لطفاً دکمه «بررسی به‌روزرسانی» را دوباره بزنید.',
        );
      }
      return;
    }

    if (this.downloadedVersion && compareSemver(this.downloadedVersion, this.app.getVersion()) <= 0) {
      this.log('جلوگیری از نصب نسخه قدیمی‌تر یا هم‌تراز:', this.downloadedVersion);
      this.setState({
        status: 'up-to-date',
        message: 'شما از آخرین نسخه استفاده می‌کنید.',
      });
      return;
    }

    this.isInstalling = true;
    this.setState({
      status: 'downloaded',
      message: 'در حال بستن سرور داخلی و اجرای نصب‌کننده نسخه جدید...',
    });
    this.log('آماده‌سازی نصب نسخه جدید از مسیر:', installerPath);

    try {
      await this.shutdown();
      if (process.platform === 'win32') {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      const launchResult = await this.launchDownloadedInstaller(installerPath);
      if (!launchResult.ok) {
        this.log('اجرای نصب‌کننده نسخه جدید ناموفق بود:', launchResult.error || 'نامشخص');
        this.dialog.showErrorBox(
          'اجرای نصب‌کننده انجام نشد',
          `بستن برنامه انجام شد اما نصب‌کننده به‌طور خودکار باز نشد.\nلطفاً روی فایل زیر دوبار کلیک کنید:\n${installerPath}`,
        );
        try {
          this.shell.showItemInFolder(installerPath);
        } catch {
          /* ignore */
        }
        this.onExitApp(1);
        return;
      }

      this.log('نصب‌کننده نسخه جدید با موفقیت اجرا شد:', launchResult.method);
      setTimeout(() => {
        this.onExitApp(0);
      }, 200);
    } catch (err) {
      this.isInstalling = false;
      this.log('خطا هنگام آماده‌سازی نصب نسخه جدید:', err?.message || String(err));
      this.dialog.showErrorBox(
        'خطا در نصب نسخه جدید',
        `امکان اجرای خودکار نصب‌کننده نبود.\nفایل نصب را می‌توانید از این مسیر اجرا کنید:\n${installerPath}`,
      );
    }
  }

  initPortableController() {
    const check = async (isManual) => {
      if (this.isDownloading || this.state.status === 'downloaded') return this.state;
      this.manualCheckRequested = isManual;
      this.setState({
        status: 'checking',
        message: isManual ? 'در حال بررسی نسخه جدید...' : undefined,
      });
      try {
        const latestVersion = await this.fetchRemoteLatestVersion();
        const currentVersion = this.app.getVersion();
        const isNewer = compareSemver(latestVersion, currentVersion) > 0;
        if (!isNewer) {
          this.log('بررسی پس‌زمینه پرتابل: برنامه به‌روز است', currentVersion);
          this.setState({
            status: isManual ? 'up-to-date' : 'idle',
            availableVersion: undefined,
            message: isManual ? 'شما از آخرین نسخه استفاده می‌کنید.' : undefined,
          });
          return this.state;
        }

        this.log('نسخه جدید در گیت‌هاب یافت شد (بدون دانلود خودکار):', latestVersion);
        if (!this.canReplacePortableExe) {
          this.setState({
            status: 'portable-available',
            availableVersion: latestVersion,
            message: `نسخه جدید ${latestVersion} منتشر شده است.`,
          });
          return this.state;
        }

        const cachedPath = path.join(
          this.portableUpdatesDir(),
          `AghrinPishFactor-Portable-${latestVersion}.exe`,
        );
        const cachedCheck = this.verifyExecutableFile(cachedPath);
        if (cachedCheck.ok) {
          this.downloadedInstallerPath = cachedPath;
          this.downloadedVersion = latestVersion;
          this.setState({
            status: 'downloaded',
            availableVersion: latestVersion,
            percent: 100,
            message: `فایل اجرایی نسخه ${latestVersion} آماده جایگزینی است.`,
          });
          return this.state;
        }

        this.setState({
          status: 'available',
          availableVersion: latestVersion,
          percent: 0,
          message: `نسخه جدید ${latestVersion} موجود است.`,
        });
        return this.state;
      } catch (err) {
        this.log('خطای بررسی نسخه پرتابل:', err?.message || String(err));
        if (isManual) {
          this.setState({
            status: 'error',
            message: this.formatError(err),
          });
        } else {
          this.setState({ status: 'idle', message: undefined });
        }
        return this.state;
      } finally {
        this.manualCheckRequested = false;
      }
    };

    const download = async (versionLabel) => {
      const targetVersion = versionLabel || this.state.availableVersion;
      if (!targetVersion || !this.canReplacePortableExe) return this.state;
      if (this.isDownloading || this.state.status === 'downloaded') return this.state;

      const currentVersion = this.app.getVersion();
      if (compareSemver(targetVersion, currentVersion) <= 0) {
        this.setState({
          status: 'up-to-date',
          message: 'شما از آخرین نسخه استفاده می‌کنید.',
        });
        return this.state;
      }

      const updatesDir = this.portableUpdatesDir();
      const finalPath = path.join(updatesDir, `AghrinPishFactor-Portable-${targetVersion}.exe`);
      const existingCheck = this.verifyExecutableFile(finalPath);
      if (existingCheck.ok) {
        this.downloadedInstallerPath = finalPath;
        this.downloadedVersion = targetVersion;
        this.setState({
          status: 'downloaded',
          availableVersion: targetVersion,
          percent: 100,
          message: `فایل اجرایی نسخه ${targetVersion} آماده جایگزینی است.`,
        });
        await this.promptConfirmInstallDialog(targetVersion, true);
        return this.state;
      }

      this.isDownloading = true;
      this.setState({
        status: 'downloading',
        availableVersion: targetVersion,
        percent: 0,
        message: `در حال دریافت فایل اجرایی نسخه ${targetVersion}...`,
      });

      const tempPath = `${finalPath}.download`;
      let writeStream = null;
      try {
        const url = await this.resolvePortableDownloadUrl(targetVersion);
        this.log('دریافت فایل اجرایی پرتابل از:', url);
        const updaterSession = this.session.fromPartition('electron-updater');
        const res = await updaterSession.fetch(url, {
          headers: { 'User-Agent': 'Aghrin-PishFactor' },
        });
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentLength = Number(res.headers.get('content-length') || '0');
        let receivedBytes = 0;
        let lastPercent = -1;
        writeStream = fs.createWriteStream(tempPath);
        const reader = res.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            receivedBytes += value.byteLength;
            await new Promise((resolve, reject) => {
              writeStream.write(Buffer.from(value), (writeErr) => {
                if (writeErr) reject(writeErr);
                else resolve();
              });
            });
            if (contentLength > 0) {
              const percent = Math.min(100, Math.max(0, Math.round((receivedBytes / contentLength) * 100)));
              if (percent !== lastPercent) {
                lastPercent = percent;
                const win = this.getMainWindow();
                if (win && !win.isDestroyed()) {
                  win.setProgressBar(percent / 100);
                }
                this.setState({
                  status: 'downloading',
                  availableVersion: targetVersion,
                  percent,
                  message: `در حال دریافت فایل اجرایی (${percent}٪)...`,
                });
              }
            }
          }
        }

        await new Promise((resolve, reject) => {
          writeStream.end((endErr) => {
            if (endErr) reject(endErr);
            else resolve();
          });
        });
        writeStream = null;

        if (contentLength > 0 && receivedBytes !== contentLength) {
          throw new Error('حجم فایل دریافتی کامل نیست');
        }

        const verified = this.verifyExecutableFile(tempPath);
        if (!verified.ok) {
          throw new Error(verified.reason);
        }

        fs.renameSync(tempPath, finalPath);
        this.downloadedInstallerPath = finalPath;
        this.downloadedVersion = targetVersion;

        const win = this.getMainWindow();
        if (win && !win.isDestroyed()) {
          win.setProgressBar(-1);
        }
        this.setState({
          status: 'downloaded',
          availableVersion: targetVersion,
          percent: 100,
          message: `فایل اجرایی نسخه ${targetVersion} آماده جایگزینی است.`,
        });
        await this.promptConfirmInstallDialog(targetVersion, true);
      } catch (err) {
        try {
          writeStream?.destroy();
        } catch {
          /* ignore */
        }
        try {
          fs.rmSync(tempPath, { force: true });
        } catch {
          /* ignore */
        }
        const win = this.getMainWindow();
        if (win && !win.isDestroyed()) {
          win.setProgressBar(-1);
        }
        this.log('خطا در دریافت فایل اجرایی نسخه جدید:', err?.message || String(err));
        this.setState({
          status: 'error',
          message: this.formatError(err),
        });
      } finally {
        this.isDownloading = false;
      }
      return this.state;
    };

    return { check, download };
  }

  initInstalledController() {
    try {
      ({ autoUpdater: this.electronUpdater } = require('electron-updater'));
    } catch (err) {
      this.log('electron-updater در دسترس نیست:', err?.message || String(err));
      return null;
    }

    const updater = this.electronUpdater;
    updater.logger = {
      info: (...args) => this.log('updater:', ...args),
      warn: (...args) => this.log('updater-warn:', ...args),
      error: (...args) => this.log('updater-err:', ...args),
      debug: () => {},
    };
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.fullChangelog = false;

    const startUpdateDownload = async (versionLabel) => {
      if (this.isDownloading || this.state.status === 'downloaded') return this.state;
      const targetVersion = versionLabel ?? this.state.availableVersion;
      if (targetVersion && compareSemver(targetVersion, this.app.getVersion()) <= 0) {
        this.setState({
          status: 'up-to-date',
          message: 'شما از آخرین نسخه استفاده می‌کنید.',
        });
        return this.state;
      }

      this.isDownloading = true;
      this.setState({
        status: 'downloading',
        availableVersion: targetVersion,
        percent: 0,
        message: targetVersion
          ? `در حال دریافت نسخه ${targetVersion}...`
          : 'در حال دریافت به‌روزرسانی...',
      });
      try {
        await updater.downloadUpdate();
      } catch (err) {
        this.isDownloading = false;
        this.log('خطا در دریافت به‌روزرسانی:', err?.message || String(err));
        this.setState({
          status: 'error',
          message: this.formatError(err),
        });
      }
      return this.state;
    };

    updater.on('checking-for-update', () => {
      this.setState({ status: 'checking', message: undefined });
    });

    updater.on('update-available', (info) => {
      if (compareSemver(info.version, this.app.getVersion()) <= 0) {
        this.manualCheckRequested = false;
        this.setState({ status: 'idle', message: undefined });
        return;
      }
      this.log('نسخه جدید یافت شد (در انتظار تأیید کاربر):', info.version);
      this.manualCheckRequested = false;
      this.setState({
        status: 'available',
        availableVersion: info.version,
        percent: 0,
        message: `نسخه جدید ${info.version} آماده دریافت است.`,
      });
    });

    updater.on('update-not-available', () => {
      this.isDownloading = false;
      this.setState({
        status: this.manualCheckRequested ? 'up-to-date' : 'idle',
        message: this.manualCheckRequested ? 'شما از آخرین نسخه استفاده می‌کنید.' : undefined,
      });
      this.manualCheckRequested = false;
    });

    updater.on('download-progress', (progress) => {
      const percent = Math.min(100, Math.max(0, Math.round(progress.percent || 0)));
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.setProgressBar(percent / 100);
      }
      this.setState({
        status: 'downloading',
        percent,
        message: `در حال دریافت به‌روزرسانی (${percent}٪)...`,
      });
    });

    updater.on('update-downloaded', async (info) => {
      this.isDownloading = false;
      this.downloadedInstallerPath = info?.downloadedFile || updater.installerPath || null;
      this.downloadedVersion = info?.version || this.state.availableVersion || null;
      this.log(
        'به‌روزرسانی آماده نصب است:',
        info.version,
        '| مسیر:',
        this.downloadedInstallerPath || '(نامشخص)',
      );
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.setProgressBar(-1);
      }
      this.setState({
        status: 'downloaded',
        availableVersion: info.version,
        percent: 100,
        message: `نسخه ${info.version} آماده نصب است.`,
      });

      await this.promptConfirmInstallDialog(info.version, false);
    });

    updater.on('error', (err) => {
      this.isDownloading = false;
      this.log('خطا در بررسی به‌روزرسانی:', err?.message || String(err));
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.setProgressBar(-1);
      }
      if (this.manualCheckRequested) {
        this.setState({
          status: 'error',
          message: this.formatError(err),
        });
      } else {
        this.setState({ status: 'idle', message: undefined });
      }
      this.manualCheckRequested = false;
    });

    return {
      check: async (isManual) => {
        if (this.isDownloading || this.state.status === 'downloaded') return this.state;
        this.manualCheckRequested = isManual;
        try {
          await updater.checkForUpdates();
        } catch (err) {
          this.log('خطای بررسی به‌روزرسانی:', err?.message || String(err));
          if (isManual) {
            this.setState({
              status: 'error',
              message: this.formatError(err),
            });
          }
          this.manualCheckRequested = false;
        }
        return this.state;
      },
      download: startUpdateDownload,
    };
  }

  start() {
    if (this.isDev) return;

    this.cleanupStaleCache();

    const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
    this.log(
      'راه‌اندازی سرویس AutoUpdater — نسخه:',
      this.app.getVersion(),
      '| پرتابل:',
      this.isPortable,
      '| جایگزینی مستقیم فایل اجرایی:',
      this.canReplacePortableExe,
      '| تنظیمات آپدیت:',
      fs.existsSync(updateConfigPath),
    );

    this.controller = this.isPortable ? this.initPortableController() : this.initInstalledController();
    if (!this.controller) return;

    const runBackgroundCheck = () => {
      const win = this.getMainWindow();
      if (!win || win.isDestroyed() || !this.controller) return;
      if (this.isDownloading || this.state.status === 'downloaded') return;
      this.controller.check(false).catch((err) => {
        this.log('خطای بررسی خودکار به‌روزرسانی:', err?.message || String(err));
      });
    };

    setTimeout(runBackgroundCheck, 6000);
    this.pollingTimer = setInterval(runBackgroundCheck, 4 * 60 * 60 * 1000);
    this.pollingTimer.unref?.();
  }

  async checkForUpdates(isManual = true) {
    if (this.isDev || !this.controller) {
      return this.setState({
        status: 'unsupported',
        message: 'بررسی خودکار فقط در نسخه ویندوزی اجراشده فعال است.',
      });
    }
    if (this.isDownloading || this.state.status === 'downloaded') {
      return this.state;
    }
    return await this.controller.check(isManual);
  }

  async downloadUpdate(versionLabel) {
    if (this.isDev || !this.controller) return this.state;
    return await this.controller.download(versionLabel ?? this.state.availableVersion);
  }

  stop() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

module.exports = { AutoUpdater };
