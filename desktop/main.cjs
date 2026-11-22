/**
 * Aghrin PishFactor — پوسته دسکتاپ ویندوز
 *
 * این فرایند چهار کار انجام می‌دهد:
 *   ۱) یک PostgreSQL همراه برنامه (embedded) را در پوشه داده کاربر اجرا می‌کند
 *      (و در صورت خطای دیتابیس روی سیستم کاربر، با فایل محلی ادامه می‌دهد).
 *   ۲) در اولین اجرا جدول‌ها را می‌سازد و حساب مدیر اولیه را ایجاد می‌کند.
 *   ۳) سرور Next.js را روی 127.0.0.1 اجرا و پنجره برنامه را باز می‌کند.
 *   ۴) در نسخه‌های نصب‌شده، به‌روزرسانی‌های جدید را به‌صورت خودکار از GitHub بررسی و نصب می‌کند.
 */
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto');

const GITHUB_RELEASES_URL = 'https://github.com/agrin111/pish-factor-/releases/latest';
const isDev = !app.isPackaged;
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
const projectRoot = path.join(__dirname, '..');
const serverRoot = isDev
  ? path.join(projectRoot, '.next', 'standalone')
  : path.join(process.resourcesPath, 'app', '.next', 'standalone');
const migrationsRoot = isDev
  ? path.join(projectRoot, 'prisma', 'migrations')
  : path.join(process.resourcesPath, 'app', 'prisma', 'migrations');

const ADMIN_USERNAME = process.env.PISHFACTOR_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.PISHFACTOR_ADMIN_PASSWORD || 'Aghrin@1404';
const ADMIN_NAME = process.env.PISHFACTOR_ADMIN_NAME || 'مدیر سیستم';

let mainWindow = null;
let splashWindow = null;
let nextProcess = null;
let postgres = null;
let logStream = null;
let autoUpdater = null;
let manualCheckRequested = false;
let shutdownPromise = null;

let updateState = {
  status: isDev ? 'unsupported' : 'idle',
  currentVersion: app.getVersion(),
  isPortable,
};

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}\n`;
  try {
    logStream?.write(line);
  } catch {
    /* ignore */
  }
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch,
    currentVersion: app.getVersion(),
    isPortable,
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:state-changed', updateState);
  }
}

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * انتخاب مسیر قابل‌نوشتن و ترجیحاً فقط ASCII برای pgdata
 * (ابزارهای PostgreSQL در ویندوز با نام کاربری فارسی/غیراسکی در مسیر خطا می‌دهند).
 */
function resolvePgDataDir() {
  const defaultDir = path.join(dataDir(), 'pgdata');
  if (/^[\x00-\x7F]+$/.test(defaultDir)) {
    return defaultDir;
  }

  const candidates = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'AghrinPishFactor', 'pgdata') : null,
    process.env.PUBLIC ? path.join(process.env.PUBLIC, 'AghrinPishFactor', 'pgdata') : null,
    'C:\\AghrinPishFactor\\pgdata',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!/^[\x00-\x7F]+$/.test(candidate)) continue;
    try {
      fs.mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      /* try next */
    }
  }
  return defaultDir;
}

function loadConfig() {
  const dir = dataDir();
  const file = path.join(dir, 'config.json');
  let config = {};
  if (fs.existsSync(file)) {
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      config = {};
    }
  }
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    config.sessionSecret = randomBytes(48).toString('hex');
  }
  if (!config.pgPassword) {
    config.pgPassword = randomBytes(24).toString('hex');
  }
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  return config;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

/** بررسی می‌کند سرور Next پاسخ می‌دهد یا نه؛ اگر پروسه زودتر بسته شد سریع خطا می‌دهد. */
function waitForServer(url, child, getStderr, timeoutMs = 90_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;

    const finishError = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    child.once('exit', (code, signal) => {
      const details = getStderr().trim();
      finishError(
        new Error(
          `سرور داخلی متوقف شد (کد ${code ?? signal ?? 'نامشخص'}).${details ? `\n${details}` : ''}`,
        ),
      );
    });

    const attempt = () => {
      if (settled) return;
      const request = http.get(url, (response) => {
        response.resume();
        if (!settled) {
          settled = true;
          resolve(true);
        }
      });
      request.on('error', () => {
        if (settled) return;
        if (Date.now() - startedAt > timeoutMs) {
          const details = getStderr().trim();
          finishError(
            new Error(
              `سرور در ${timeoutMs / 1000} ثانیه آماده نشد.${details ? `\n${details}` : ''}`,
            ),
          );
          return;
        }
        setTimeout(attempt, 500);
      });
      request.setTimeout(4000, () => request.destroy());
    };
    attempt();
  });
}

/** ایجاد جدول‌ها از فایل‌های migration و ثبت آن‌ها در جدول داخلی. */
async function applyMigrations(client) {
  await client.query(
    'CREATE TABLE IF NOT EXISTS _desktop_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = new Set(
    (await client.query('SELECT name FROM _desktop_migrations')).rows.map((row) => row.name),
  );
  const directories = fs.existsSync(migrationsRoot)
    ? fs
        .readdirSync(migrationsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  for (const name of directories) {
    if (applied.has(name)) continue;
    const sqlFile = path.join(migrationsRoot, name, 'migration.sql');
    if (!fs.existsSync(sqlFile)) continue;
    const sql = fs.readFileSync(sqlFile, 'utf8');
    log('اعمال migration:', name);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _desktop_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

/** افزودن دسته‌بندی‌های پیش‌فرض کالا بدون تداخل با دسته‌های قبلی */
async function ensureDefaultCategories(client) {
  const defaultCategories = [
    ['cat_building_materials', 'مصالح ساختمانی', 1],
    ['cat_building_iron', 'آهن آلات ساختمانی', 2],
    ['cat_building_tools', 'ابزار آلات ساختمانی', 3],
    ['cat_facilities', 'تاسیسات', 4],
    ['cat_alloy', 'آلیاژی', 5],
  ];

  for (const [id, name, sortOrder] of defaultCategories) {
    await client.query(
      `INSERT INTO "ProductCategory" (id, name, "sortOrder", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, now(), now())
       ON CONFLICT (name) DO NOTHING`,
      [id, name, sortOrder],
    );
  }
}

/** ایجاد تنظیمات پیش‌فرض شرکت و اولین حساب مدیر. */
async function seedFirstRun(client) {
  await client.query(
    `INSERT INTO company_settings (id, "companyName", currency, "defaultVatRate", "defaultIncludeVat", "defaultValidDays", "numberPrefix", "updatedAt")
     VALUES (1, 'شرکت آهن آگرین', 'TOMAN', 10, false, 7, 'AG', now())
     ON CONFLICT (id) DO NOTHING`,
  );

  await ensureDefaultCategories(client);

  const { rows } = await client.query('SELECT count(*)::int AS count FROM "User"');
  if (rows[0].count > 0) return false;

  const id = `usr_${randomBytes(12).toString('hex')}`;
  await client.query(
    `INSERT INTO "User" (id, username, "fullName", "passwordHash", role, "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'ADMIN', true, now(), now())`,
    [id, ADMIN_USERNAME, ADMIN_NAME, hashPassword(ADMIN_PASSWORD)],
  );
  return true;
}

async function startDatabase(config) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pgData = resolvePgDataDir();
  const port = await findFreePort();

  // پاک‌سازی پوشه ناقص از اجرای ناموفق قبلی
  const pgVersionFile = path.join(pgData, 'PG_VERSION');
  if (fs.existsSync(pgData) && !fs.existsSync(pgVersionFile)) {
    log('پاک‌سازی پوشه ناقص دیتابیس:', pgData);
    fs.rmSync(pgData, { recursive: true, force: true });
  }

  // حذف قفل باقی‌مانده از بسته شدن ناگهانی قبلی
  const pidFile = path.join(pgData, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    log('حذف فایل قفل قدیمی postmaster.pid');
    fs.rmSync(pidFile, { force: true });
  }

  postgres = new EmbeddedPostgres({
    databaseDir: pgData,
    user: 'pishfactor',
    password: config.pgPassword,
    port,
    persistent: true,
    onLog: (msg) => log('pg:', String(msg).trim()),
    onError: (err) => log('pg-err:', err?.message || String(err)),
  });

  if (!fs.existsSync(pgVersionFile)) {
    log('راه‌اندازی اولیه دیتابیس در', pgData);
    await postgres.initialise();
  }
  await postgres.start();
  log('PostgreSQL روی پورت', port, 'اجرا شد');

  const { Client } = require('pg');

  // اتصال مستقیم به 127.0.0.1 برای اطمینان از ساخت دیتابیس pishfactor (بدون وابستگی به localhost/IPv6)
  const adminClient = new Client({
    host: '127.0.0.1',
    port,
    user: 'pishfactor',
    password: config.pgPassword,
    database: 'postgres',
  });
  await adminClient.connect();
  try {
    const dbCheck = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'pishfactor'",
    );
    if (dbCheck.rowCount === 0) {
      await adminClient.query('CREATE DATABASE pishfactor');
      log('دیتابیس pishfactor ایجاد شد');
    }
  } finally {
    await adminClient.end();
  }

  const client = new Client({
    host: '127.0.0.1',
    port,
    user: 'pishfactor',
    password: config.pgPassword,
    database: 'pishfactor',
  });
  await client.connect();
  try {
    await applyMigrations(client);
    const createdAdmin = await seedFirstRun(client);
    log(createdAdmin ? 'حساب مدیر اولیه ساخته شد' : 'حساب مدیر از قبل وجود دارد');
  } finally {
    await client.end();
  }

  return port;
}

async function startApp() {
  const config = loadConfig();
  let databaseUrl = '';

  try {
    const pgPort = await startDatabase(config);
    databaseUrl = `postgresql://pishfactor:${encodeURIComponent(config.pgPassword)}@127.0.0.1:${pgPort}/pishfactor?schema=public`;
  } catch (dbError) {
    log('هشدار: PostgreSQL راه‌اندازی نشد، استفاده از ذخیره‌سازی محلی فایل‌محور:', dbError?.stack || String(dbError));
    try {
      await postgres?.stop();
    } catch {
      /* ignore */
    }
    postgres = null;
  }

  const appPort = await findFreePort();
  const serverEntry = path.join(serverRoot, 'server.js');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`فایل سرور پیدا نشد: ${serverEntry}`);
  }

  const localDbFile = path.join(dataDir(), 'local-db.json');
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    PORT: String(appPort),
    HOSTNAME: '127.0.0.1',
    SESSION_SECRET: config.sessionSecret,
    SESSION_TTL_HOURS: '12',
    APP_URL: `http://127.0.0.1:${appPort}`,
    SEED_ADMIN_USERNAME: ADMIN_USERNAME,
    SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
    SEED_ADMIN_NAME: ADMIN_NAME,
    PISHFACTOR_DATA_FILE: localDbFile,
  };

  if (databaseUrl) {
    env.DATABASE_URL = databaseUrl;
  } else {
    delete env.DATABASE_URL;
  }

  nextProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let recentStderr = '';
  nextProcess.stdout?.on('data', (chunk) => log('next:', chunk.toString().trim()));
  nextProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString().trim();
    log('next-err:', text);
    recentStderr = `${recentStderr}\n${text}`.slice(-1200);
  });
  nextProcess.on('exit', (code) => log('پروسه سرور بسته شد، کد:', code));

  await waitForServer(`http://127.0.0.1:${appPort}/login`, nextProcess, () => recentStderr);
  return `http://127.0.0.1:${appPort}`;
}

function shutdown() {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    const proc = nextProcess;
    nextProcess = null;
    if (proc && proc.exitCode === null) {
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        proc.once('exit', finish);
        try {
          proc.kill();
        } catch {
          finish();
          return;
        }
        setTimeout(() => {
          if (done) return;
          try {
            if (process.platform === 'win32' && proc.pid) {
              spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore',
              });
            } else {
              proc.kill('SIGKILL');
            }
          } catch {
            /* ignore */
          }
          setTimeout(finish, 400);
        }, 2500);
      });
    }
    try {
      await postgres?.stop();
      postgres = null;
    } catch {
      /* ignore */
    }
  })();
  return shutdownPromise;
}

async function installDownloadedUpdate() {
  if (!autoUpdater) return;
  log('آماده‌سازی نصب نسخه جدید و بستن سرور داخلی...');
  await shutdown();
  autoUpdater.quitAndInstall(false, true);
}

function formatUpdaterError(err) {
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

function initAutoUpdater() {
  if (isDev) return;

  const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
  log(
    'راه‌اندازی بررسی به‌روزرسانی — نسخه:',
    app.getVersion(),
    '| پرتابل:',
    isPortable,
    '| تنظیمات آپدیت:',
    fs.existsSync(updateConfigPath),
  );

  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    log('electron-updater در دسترس نیست:', err?.message || String(err));
    return;
  }

  autoUpdater.logger = {
    info: (...args) => log('updater:', ...args),
    warn: (...args) => log('updater-warn:', ...args),
    error: (...args) => log('updater-err:', ...args),
    debug: () => {},
  };
  autoUpdater.autoDownload = !isPortable;
  autoUpdater.autoInstallOnAppQuit = !isPortable;
  autoUpdater.allowDowngrade = false;
  autoUpdater.fullChangelog = false;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({ status: 'checking', message: undefined });
  });

  autoUpdater.on('update-available', (info) => {
    log('نسخه جدید یافت شد:', info.version);
    if (isPortable) {
      setUpdateState({
        status: 'portable-available',
        availableVersion: info.version,
        message: `نسخه ${info.version} روی گیت‌هاب منتشر شده است.`,
      });
    } else {
      setUpdateState({
        status: 'available',
        availableVersion: info.version,
        percent: 0,
        message: `در حال دریافت نسخه ${info.version}...`,
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      status: manualCheckRequested ? 'up-to-date' : 'idle',
      message: manualCheckRequested ? 'شما از آخرین نسخه استفاده می‌کنید.' : undefined,
    });
    manualCheckRequested = false;
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.min(100, Math.max(0, Math.round(progress.percent || 0)));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(percent / 100);
    }
    setUpdateState({
      status: 'downloading',
      percent,
      message: `در حال دریافت به‌روزرسانی (${percent}٪)...`,
    });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    log('به‌روزرسانی آماده نصب است:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    setUpdateState({
      status: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      message: `نسخه ${info.version} آماده نصب است.`,
    });

    if (!mainWindow || mainWindow.isDestroyed()) return;

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'به‌روزرسانی جدید آماده است',
      message: `نسخه جدید Aghrin PishFactor (${info.version}) از گیت‌هاب دریافت شد.`,
      detail:
        'تمام اطلاعات شما (پیش‌فاکتورها، مشتریان و تنظیمات) حفظ می‌شود.\nآیا مایلید اکنون نصب و برنامه مجدداً راه‌اندازی شود؟',
      buttons: ['نصب و راه‌اندازی مجدد', 'بعداً (هنگام خروج)'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      await installDownloadedUpdate();
    }
  });

  autoUpdater.on('error', (err) => {
    log('خطا در بررسی به‌روزرسانی:', err?.message || String(err));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    if (manualCheckRequested) {
      setUpdateState({
        status: 'error',
        message: formatUpdaterError(err),
      });
    } else {
      setUpdateState({ status: 'idle', message: undefined });
    }
    manualCheckRequested = false;
  });

  const runBackgroundCheck = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    manualCheckRequested = false;
    autoUpdater.checkForUpdates().catch((err) => {
      log('خطای بررسی خودکار به‌روزرسانی:', err?.message || String(err));
    });
  };

  setTimeout(runBackgroundCheck, 6000);
  const timer = setInterval(runBackgroundCheck, 4 * 60 * 60 * 1000);
  timer.unref?.();
}

function registerIpc() {
  ipcMain.handle('updater:state', () => updateState);

  ipcMain.handle('updater:check', async () => {
    if (isDev || !autoUpdater) {
      setUpdateState({
        status: 'unsupported',
        message: 'بررسی خودکار فقط در نسخه نصب‌شده ویندوز فعال است.',
      });
      return updateState;
    }
    manualCheckRequested = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      log('خطای بررسی دستی به‌روزرسانی:', err?.message || String(err));
      setUpdateState({
        status: 'error',
        message: formatUpdaterError(err),
      });
      manualCheckRequested = false;
    }
    return updateState;
  });

  ipcMain.handle('updater:install', async () => {
    await installDownloadedUpdate();
  });

  ipcMain.handle('updater:open-releases', async () => {
    await shell.openExternal(GITHUB_RELEASES_URL);
  });

  ipcMain.handle('print:document', async (_event, options) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { ok: false, error: 'پنجره برنامه در دسترس نیست.' };
    }
    const pageSize = options?.pageSize === 'A5' ? 'A5' : 'A4';
    return await new Promise((resolve) => {
      try {
        mainWindow.webContents.print(
          {
            silent: false,
            printBackground: true,
            pageSize,
          },
          (success, failureReason) => {
            if (success) {
              resolve({ ok: true });
            } else if (failureReason === 'cancelled') {
              resolve({ ok: false, canceled: true });
            } else {
              log('خطای چاپ:', failureReason || 'نامشخص');
              resolve({
                ok: false,
                error: failureReason || 'ارسال به چاپگر انجام نشد.',
              });
            }
          },
        );
      } catch (err) {
        log('خطای چاپ:', err?.message || String(err));
        resolve({ ok: false, error: 'ارسال به چاپگر با خطا مواجه شد.' });
      }
    });
  });

  ipcMain.handle('file:save-pdf', async (_event, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { ok: false, error: 'پنجره برنامه در دسترس نیست.' };
    }
    try {
      const rawName = String(payload?.defaultFileName || 'invoice.pdf').replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        '_',
      );
      const fileName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'ذخیره فایل PDF',
        defaultPath: path.join(app.getPath('downloads'), fileName),
        filters: [{ name: 'فایل PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) {
        return { ok: false, canceled: true };
      }
      const bytes = payload?.bytes;
      const buffer = Buffer.isBuffer(bytes)
        ? bytes
        : ArrayBuffer.isView(bytes)
          ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          : Buffer.from(bytes || []);
      fs.writeFileSync(filePath, buffer);
      return { ok: true, filePath };
    } catch (err) {
      log('خطا در ذخیره فایل PDF:', err?.message || String(err));
      return { ok: false, error: 'ذخیره فایل PDF در مسیر انتخابی انجام نشد.' };
    }
  });

  ipcMain.handle('file:open-path', async (_event, targetPath) => {
    if (!targetPath || typeof targetPath !== 'string') return false;
    const result = await shell.openPath(targetPath);
    return result === '';
  });
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    show: true,
    backgroundColor: '#172535',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'loading.html'));
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#F1F3F5',
    title: 'Aghrin PishFactor',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    splashWindow?.destroy();
    splashWindow = null;
    mainWindow?.show();
    initAutoUpdater();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    try {
      const parsed = new URL(target);
      const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
      if (isLocal) {
        if (parsed.pathname.startsWith('/api/')) {
          mainWindow?.webContents.downloadURL(target);
        } else {
          mainWindow?.loadURL(target);
        }
        return { action: 'deny' };
      }
    } catch {
      /* ignore invalid URL */
    }
    shell.openExternal(target);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.requestSingleInstanceLock();

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  logStream = fs.createWriteStream(path.join(dataDir(), 'desktop.log'), { flags: 'a' });

  // پنجره رابط کاربری فقط مجاز به درخواست به سرور محلی 127.0.0.1 است؛
  // سرویس به‌روزرسانی خودکار از session جداگانه ('electron-updater') استفاده می‌کند.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    try {
      const parsed = new URL(details.url);
      const allowed =
        parsed.protocol === 'data:' ||
        parsed.protocol === 'blob:' ||
        parsed.protocol === 'file:' ||
        parsed.protocol === 'devtools:' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === 'localhost';
      callback({ cancel: !allowed });
    } catch {
      callback({ cancel: false });
    }
  });

  session.defaultSession.on('will-download', (_event, item) => {
    const suggested = item.getFilename() || 'download';
    const defaultPath = path.join(app.getPath('downloads'), suggested);
    if (mainWindow && !mainWindow.isDestroyed()) {
      const chosen = dialog.showSaveDialogSync(mainWindow, {
        title: 'ذخیره فایل',
        defaultPath,
      });
      if (chosen) {
        item.setSavePath(chosen);
      } else {
        item.cancel();
      }
    } else {
      item.setSavePath(defaultPath);
    }
  });

  registerIpc();
  createSplash();
  try {
    const url = await startApp();
    createMainWindow(url);
  } catch (error) {
    log('خطای اجرا:', error?.stack || String(error));
    splashWindow?.destroy();
    dialog.showErrorBox(
      'اجرای برنامه ممکن نشد',
      `${error?.message ?? error}\n\nگزارش کامل: ${path.join(dataDir(), 'desktop.log')}`,
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  shutdown();
});

process.on('exit', () => {
  shutdown();
});
