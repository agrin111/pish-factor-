/**
 * Aghrin PishFactor — پوسته دسکتاپ ویندوز
 *
 * این فرایند سه کار انجام می‌دهد:
 *   ۱) یک PostgreSQL همراه برنامه (embedded) را در پوشه داده کاربر اجرا می‌کند.
 *   ۲) در اولین اجرا جدول‌ها را می‌سازد و حساب مدیر اولیه را ایجاد می‌کند.
 *   ۳) سرور Next.js را روی 127.0.0.1 اجرا و پنجره برنامه را باز می‌کند.
 *
 * هیچ نصب جداگانه‌ای (Node، PostgreSQL، Docker) لازم نیست.
 */
const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto');

// --------------------------------------------------------------------------
// حالت کاملاً آفلاین
// تنها آدرس مجاز 127.0.0.1 (سرور داخلی برنامه) است؛ Chromium هیچ درخواستی به
// اینترنت یا DNS بیرونی نمی‌فرستد. فونت‌ها، آیکون‌ها و PDF همگی محلی‌اند.
// --------------------------------------------------------------------------
app.commandLine.appendSwitch(
  'host-resolver-rules',
  'MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
);

const isDev = !app.isPackaged;
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

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}\n`;
  try {
    logStream?.write(line);
  } catch {
    /* ignore */
  }
}

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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

/** بررسی می‌کند سرور Next پاسخ می‌دهد یا نه. */
function waitForServer(url, timeoutMs = 90_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(true);
      });
      request.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`سرور در ${timeoutMs / 1000} ثانیه آماده نشد.`));
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

/** ایجاد تنظیمات پیش‌فرض شرکت و اولین حساب مدیر. */
async function seedFirstRun(client) {
  await client.query(
    `INSERT INTO company_settings (id, "companyName", currency, "defaultVatRate", "defaultIncludeVat", "defaultValidDays", "numberPrefix", "updatedAt")
     VALUES (1, 'شرکت آهن آگرین', 'TOMAN', 10, false, 7, 'AG', now())
     ON CONFLICT (id) DO NOTHING`,
  );

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
  const pgData = path.join(dataDir(), 'pgdata');
  const port = await findFreePort();

  postgres = new EmbeddedPostgres({
    databaseDir: pgData,
    user: 'pishfactor',
    password: config.pgPassword,
    port,
    persistent: true,
  });

  if (!fs.existsSync(path.join(pgData, 'PG_VERSION'))) {
    log('راه‌اندازی اولیه دیتابیس در', pgData);
    await postgres.initialise();
  }
  await postgres.start();
  log('PostgreSQL روی پورت', port, 'اجرا شد');

  try {
    await postgres.createDatabase('pishfactor');
  } catch {
    /* دیتابیس از قبل وجود دارد */
  }

  const { Client } = require('pg');
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
  const pgPort = await startDatabase(config);
  const appPort = await findFreePort();

  const databaseUrl = `postgresql://pishfactor:${encodeURIComponent(config.pgPassword)}@127.0.0.1:${pgPort}/pishfactor?schema=public`;
  const serverEntry = path.join(serverRoot, 'server.js');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`فایل سرور پیدا نشد: ${serverEntry}`);
  }

  nextProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: String(appPort),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: config.sessionSecret,
      SESSION_TTL_HOURS: '12',
      APP_URL: `http://127.0.0.1:${appPort}`,
      SEED_ADMIN_USERNAME: ADMIN_USERNAME,
      SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
      SEED_ADMIN_NAME: ADMIN_NAME,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  nextProcess.stdout?.on('data', (chunk) => log('next:', chunk.toString().trim()));
  nextProcess.stderr?.on('data', (chunk) => log('next-err:', chunk.toString().trim()));
  nextProcess.on('exit', (code) => log('پروسه سرور بسته شد، کد:', code));

  await waitForServer(`http://127.0.0.1:${appPort}/login`);
  return `http://127.0.0.1:${appPort}`;
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
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    splashWindow?.destroy();
    splashWindow = null;
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function shutdown() {
  try {
    nextProcess?.kill();
  } catch {
    /* ignore */
  }
  try {
    await postgres?.stop();
  } catch {
    /* ignore */
  }
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
