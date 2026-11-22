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
const { app, BrowserWindow, clipboard, dialog, ipcMain, shell, Menu, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto');
const { AutoUpdater } = require('./auto-updater.cjs');

const GITHUB_RELEASES_URL = 'https://github.com/agrin111/pish-factor-/releases/latest';
const isDev = !app.isPackaged;
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);
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
let autoUpdaterService = null;
let shutdownPromise = null;
let isQuitting = false;
let shutdownCompleted = false;
let activePgDataDir = null;

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}\n`;
  try {
    logStream?.write(line);
  } catch {
    /* ignore */
  }
}

function getUpdaterService() {
  if (!autoUpdaterService) {
    autoUpdaterService = new AutoUpdater({
      app,
      dialog,
      shell,
      session,
      getMainWindow: () => mainWindow,
      shutdown: async () => {
        isQuitting = true;
        await shutdown();
      },
      onExitApp: (code) => {
        isQuitting = true;
        shutdownCompleted = true;
        try {
          logStream?.end();
        } catch {
          /* ignore */
        }
        app.exit(code);
      },
      log,
    });
  }
  return autoUpdaterService;
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
  let dirty = !fs.existsSync(file);
  if (!dirty) {
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      config = {};
      dirty = true;
    }
  }
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    config.sessionSecret = randomBytes(48).toString('hex');
    dirty = true;
  }
  if (!config.pgPassword) {
    config.pgPassword = randomBytes(24).toString('hex');
    dirty = true;
  }
  if (dirty) {
    fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  }
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
  activePgDataDir = pgData;
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
  autoUpdaterService?.stop();
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
              const killer = spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore',
              });
              killer.once('close', finish);
              killer.once('error', finish);
              setTimeout(finish, 1500);
              return;
            }
            proc.kill('SIGKILL');
          } catch {
            /* ignore */
          }
          setTimeout(finish, 400);
        }, 2500);
      });
    }
    const pg = postgres;
    postgres = null;
    if (pg) {
      let stoppedCleanly = false;
      try {
        await Promise.race([
          pg.stop().then(() => {
            stoppedCleanly = true;
          }),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      } catch {
        /* ignore */
      }
      if (!stoppedCleanly && process.platform === 'win32' && activePgDataDir) {
        try {
          const pidFile = path.join(activePgDataDir, 'postmaster.pid');
          if (fs.existsSync(pidFile)) {
            const firstLine = fs.readFileSync(pidFile, 'utf8').split(/\r?\n/)[0]?.trim();
            if (firstLine && /^\d+$/.test(firstLine)) {
              await new Promise((resolve) => {
                const killer = spawn('taskkill', ['/pid', firstLine, '/T', '/F'], {
                  windowsHide: true,
                  stdio: 'ignore',
                });
                killer.once('close', resolve);
                killer.once('error', resolve);
                setTimeout(resolve, 1500);
              });
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (process.platform === 'win32') {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    shutdownCompleted = true;
  })();
  return shutdownPromise;
}

function initAutoUpdater() {
  getUpdaterService().start();
}

function registerIpc() {
  ipcMain.handle('updater:state', () => getUpdaterService().getState());

  ipcMain.handle('updater:check', async () => {
    return await getUpdaterService().checkForUpdates(true);
  });

  ipcMain.handle('updater:download', async () => {
    return await getUpdaterService().downloadUpdate();
  });

  ipcMain.handle('updater:install', async () => {
    await getUpdaterService().installUpdate();
  });

  ipcMain.handle('updater:open-releases', async () => {
    setImmediate(() => {
      shell.openExternal(GITHUB_RELEASES_URL).catch(() => {});
    });
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

  const MAX_PDF_BYTES = 40 * 1024 * 1024;
  const SAFE_USER_EXTS = new Set(['.pdf', '.csv', '.json', '.log']);

  function isSafeUserDocumentPath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return false;
    try {
      const resolved = path.resolve(targetPath);
      const ext = path.extname(resolved).toLowerCase();
      if (!SAFE_USER_EXTS.has(ext)) return false;
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return false;
      const allowedRoots = [
        app.getPath('downloads'),
        app.getPath('documents'),
        app.getPath('desktop'),
        app.getPath('userData'),
      ].map((dir) => path.resolve(dir).toLowerCase());
      const normalized = resolved.toLowerCase();
      return allowedRoots.some(
        (root) => normalized === root || normalized.startsWith(`${root}${path.sep}`),
      );
    } catch {
      return false;
    }
  }

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
      const bytes = payload?.bytes;
      const buffer = Buffer.isBuffer(bytes)
        ? bytes
        : ArrayBuffer.isView(bytes)
          ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          : Buffer.from(bytes || []);
      if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
        return { ok: false, error: 'اندازه فایل PDF نامعتبر است.' };
      }
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'ذخیره فایل PDF',
        defaultPath: path.join(app.getPath('downloads'), fileName),
        filters: [{ name: 'فایل PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) {
        return { ok: false, canceled: true };
      }
      fs.writeFileSync(filePath, buffer);
      return { ok: true, filePath };
    } catch (err) {
      log('خطا در ذخیره فایل PDF:', err?.message || String(err));
      return { ok: false, error: 'ذخیره فایل PDF در مسیر انتخابی انجام نشد.' };
    }
  });

  ipcMain.handle('file:open-path', async (_event, targetPath) => {
    if (!isSafeUserDocumentPath(targetPath)) return false;
    try {
      const resolved = path.resolve(targetPath);
      const result = await Promise.race([
        shell.openPath(resolved),
        new Promise((resolve) => setTimeout(() => resolve(''), 3000)),
      ]);
      return result === '';
    } catch (err) {
      log('خطا در باز کردن فایل:', err?.message || String(err));
      return false;
    }
  });

  ipcMain.handle('file:save-share-pdf', async (_event, payload) => {
    const rawName = String(payload?.defaultFileName || 'invoice.pdf').replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      '_',
    );
    const fileName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;
    const bytes = payload?.bytes;
    const buffer = Buffer.isBuffer(bytes)
      ? bytes
      : ArrayBuffer.isView(bytes)
        ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : Buffer.from(bytes || []);

    if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
      return { ok: false, error: 'اندازه فایل PDF نامعتبر است.' };
    }

    const candidateDirs = [
      path.join(app.getPath('documents'), 'AghrinPishFactor-Exports'),
      path.join(app.getPath('downloads'), 'AghrinPishFactor-Exports'),
      path.join(dataDir(), 'exports'),
    ];

    for (const exportDir of candidateDirs) {
      try {
        await fs.promises.mkdir(exportDir, { recursive: true });
        const filePath = path.join(exportDir, fileName);
        await fs.promises.writeFile(filePath, buffer);
        return { ok: true, filePath };
      } catch (err) {
        log('مسیر ذخیره اشتراک‌گذاری در دسترس نبود:', exportDir, err?.message || String(err));
      }
    }

    return { ok: false, error: 'ذخیره فایل PDF برای اشتراک‌گذاری انجام نشد.' };
  });

  ipcMain.handle('file:show-in-folder', (_event, targetPath) => {
    if (!isSafeUserDocumentPath(targetPath)) return false;
    const resolved = path.resolve(targetPath);
    setImmediate(() => {
      try {
        shell.showItemInFolder(resolved);
      } catch (err) {
        log('خطا در نمایش فایل در پوشه:', err?.message || String(err));
      }
    });
    return true;
  });

  ipcMain.handle('shell:open-external', async (_event, targetUrl) => {
    if (!targetUrl || typeof targetUrl !== 'string') return false;
    try {
      const parsed = new URL(targetUrl);
      const allowedProtocols = ['https:', 'http:', 'mailto:', 'tg:', 'whatsapp:'];
      if (!allowedProtocols.includes(parsed.protocol)) return false;

      return await new Promise((resolve) => {
        let settled = false;
        const done = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const timer = setTimeout(() => done(true), 1200);
        setImmediate(() => {
          shell
            .openExternal(targetUrl)
            .then(() => {
              clearTimeout(timer);
              done(true);
            })
            .catch((err) => {
              clearTimeout(timer);
              log('خطا در باز کردن لینک خارجی:', targetUrl, err?.message || String(err));
              done(false);
            });
        });
      });
    } catch {
      return false;
    }
  });

  ipcMain.handle('clipboard:write-text', (_event, text) => {
    try {
      clipboard.writeText(String(text || ''));
      return true;
    } catch {
      return false;
    }
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
    try {
      const parsedExternal = new URL(target);
      if (['https:', 'http:', 'mailto:', 'tg:', 'whatsapp:'].includes(parsedExternal.protocol)) {
        setImmediate(() => {
          shell.openExternal(target).catch((err) => {
            log('خطا در باز کردن لینک خارجی:', target, err?.message || String(err));
          });
        });
      }
    } catch {
      /* ignore invalid URL */
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  shutdownCompleted = true;
  app.quit();
} else {
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
      callback({ cancel: true });
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
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', (event) => {
  if (shutdownCompleted) return;
  event.preventDefault();
  if (isQuitting) return;
  isQuitting = true;
  shutdown()
    .catch((err) => log('خطا هنگام بستن سرویس‌ها:', err?.message || String(err)))
    .finally(() => {
      shutdownCompleted = true;
      app.quit();
    });
});

process.on('exit', () => {
  if (!shutdownCompleted && nextProcess && nextProcess.exitCode === null) {
    try {
      nextProcess.kill();
    } catch {
      /* ignore */
    }
  }
});
