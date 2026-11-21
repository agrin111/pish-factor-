/**
 * ساخت نصب‌کننده ویندوز (Aghrin PishFactor Setup .exe)
 *
 *   npm run build          # ابتدا بیلد Next.js
 *   npm run desktop:build  # سپس بسته‌بندی ویندوز
 *
 * نکته مهم: این اسکریپت باید روی ویندوز اجرا شود؛ چون باینری‌های PostgreSQL
 * همراه برنامه و موتور Prisma برای ویندوز در همان محیط نصب می‌شوند.
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!existsSync(path.join(standalone, 'server.js'))) {
  fail('خروجی standalone پیدا نشد. ابتدا «npm run build» را اجرا کنید.');
}

// فایل‌های ایستا و عمومی باید داخل پوشه standalone باشند تا سرور داخلی آن‌ها را سرو کند
const copies = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
  ['assets/fonts', '.next/standalone/assets/fonts'],
];

for (const [from, to] of copies) {
  const source = path.join(root, from);
  if (!existsSync(source)) fail(`مسیر لازم پیدا نشد: ${from}`);
  cpSync(source, path.join(root, to), { recursive: true });
  console.log(`✔ ${from} → ${to}`);
}

if (!existsSync(path.join(root, 'desktop', 'icon.ico'))) {
  fail('آیکون برنامه پیدا نشد: desktop/icon.ico');
}
const migrations = path.join(root, 'prisma', 'migrations');
const migrationDirs = readdirSync(migrations, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
if (migrationDirs.length === 0) fail('هیچ migration‌ای در prisma/migrations پیدا نشد.');
console.log(`✔ ${migrationDirs.length} migration برای اولین اجرا آماده است`);

// --- بررسی آمادگی نسخه آفلاین ویندوز -------------------------------------
// برنامه در زمان اجرا به اینترنت نیاز ندارد، اما دو باینری مخصوص ویندوز باید
// داخل بسته باشد؛ در غیر این صورت برنامه روی سیستم کاربر باز نمی‌شود.
if (process.platform === 'win32') {
  if (!existsSync(path.join(root, 'node_modules', '@embedded-postgres', 'windows-x64'))) {
    fail(
      'باینری PostgreSQL ویندوز نصب نیست. دستور «npm ci» را دوباره اجرا کنید ' +
        '(بسته @embedded-postgres/windows-x64 باید نصب شود).',
    );
  }

  // اسکریپت postinstall این بسته، باینری‌ها را در native/bin آماده می‌کند. اگر
  // npm آن اسکریپت را اجرا نکرده باشد، بسته ساخته می‌شود ولی در اولین اجرا
  // دیتابیس راه نمی‌افتد؛ پس همین‌جا جلوی ساخت را می‌گیریم.
  const pgBinary = path.join(
    root,
    'node_modules',
    '@embedded-postgres',
    'windows-x64',
    'native',
    'bin',
    'postgres.exe',
  );
  if (!existsSync(pgBinary)) {
    fail(
      'فایل postgres.exe داخل بسته PostgreSQL ویندوز پیدا نشد؛ یعنی اسکریپت نصب آن اجرا نشده است.\n' +
        '  راه‌حل: «npm ci» را دوباره اجرا کنید. اگر باز هم درست نشد، Node.js 22 LTS را نصب کنید\n' +
        '  (نسخه‌های جدید npm اسکریپت‌های نصب را به‌صورت پیش‌فرض اجرا نمی‌کنند).',
    );
  }

  const prismaClientDir = path.join(root, 'node_modules', '.prisma', 'client');
  const prismaEngine = existsSync(prismaClientDir)
    ? readdirSync(prismaClientDir).find((file) => file.includes('windows'))
    : undefined;
  if (!prismaEngine) {
    fail('موتور Prisma برای ویندوز ساخته نشده است. دستور «npx prisma generate» را اجرا کنید.');
  }
  console.log('✔ باینری‌های ویندوزی PostgreSQL و Prisma آماده‌اند');
} else {
  console.warn(
    '\n⚠ این اسکریپت برای ساخت نصب‌کننده ویندوز طراحی شده است. ساخت نسخه ویندوزی از لینوکس/مک\n' +
      '  قابل اطمینان نیست، چون باینری‌های PostgreSQL و موتور Prisma مخصوص ویندوز باید همراه بسته شوند.\n' +
      '  روی ویندوز «desktop\\build-windows.bat» را دوبار کلیک کنید یا از گردش‌کار GitHub Actions\n' +
      '  (.github/workflows/windows-installer.yml) استفاده کنید.\n',
  );
}

// اطمینان از اینکه هیچ فایل حساسی داخل بسته نمی‌رود
for (const sensitive of ['.env', '.env.local', 'desktop.log']) {
  if (existsSync(path.join(root, sensitive))) {
    console.log(`ℹ ${sensitive} در ریشه پروژه هست ولی در بسته ویندوز کپی نمی‌شود`);
  }
}
if (existsSync(path.join(root, '.env'))) {
  const envFile = readFileSync(path.join(root, '.env'), 'utf8');
  if (envFile.includes('DATABASE_URL')) {
    console.log('ℹ تنظیمات .env فقط برای محیط توسعه است؛ نسخه دسکتاپ تنظیمات خودش را می‌سازد');
  }
}

const builder = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
if (!existsSync(builder)) {
  fail('electron-builder نصب نیست. «npm install» را اجرا کنید.');
}

// --- پاک‌سازی خروجی قبلی ----------------------------------------------------
// اگر نسخه قبلی باز مانده باشد، electron-builder نمی‌تواند exe قفل‌شده را پاک
// کند و با پیام خام «Access is denied» متوقف می‌شود. اینجا چند بار تلاش
// می‌کنیم و راهنمای روشن می‌دهیم.
const releaseDir = path.join(root, 'release');
const appExecutables = ['Aghrin Pish Factor.exe', 'AghrinPishFactor.exe'];
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function runningInstances() {
  if (process.platform !== 'win32') return [];
  const out = spawnSync('tasklist', ['/nh'], { encoding: 'utf8' });
  const lines = (out.stdout || '').toLowerCase();
  return appExecutables.filter((name) => lines.includes(name.toLowerCase()));
}

function cleanupRelease() {
  if (!existsSync(releaseDir)) return;
  const waitUntil = Date.now() + 20_000;
  let warned = false;
  for (;;) {
    try {
      rmSync(releaseDir, { recursive: true, force: true });
      return;
    } catch {
      if (!warned) {
        warned = true;
        const running = runningInstances();
        console.log('\n⚠ خروجی ساخت قبلی در پوشه release قفل شده است.');
        if (running.length > 0) {
          console.log(`  یک نسخه از برنامه باز است (${running.join('، ')}).`);
          console.log('  پنجره برنامه و آیکون آن در System Tray را ببندید؛ ساخت تا ۲۰ ثانیهٔ دیگر خودش ادامه می‌دهد.');
        } else {
          console.log('  احتمالاً آنتی‌ویروس فایل را در اختیار دارد؛ ساخت تا ۲۰ ثانیهٔ دیگر خودش ادامه می‌دهد.');
        }
      }
      if (Date.now() > waitUntil) {
        fail(
          'پوشه release قابل پاک‌سازی نیست.\n' +
            '  برنامه را ببندید (یا در cmd: taskkill /f /im "Aghrin Pish Factor.exe")،\n' +
            '  سپس پوشه release را دستی حذف کنید و ساخت را دوباره اجرا کنید.\n' +
            '  اگر فایل هنوز قفل است، پوشه پروژه را در استثناهای آنتی‌ویروس قرار دهید.',
        );
      }
    }
    sleepSync(1000);
  }
}

cleanupRelease();

console.log('\n⏳ ساخت فایل‌های نصبی و پرتابل ویندوز... (چند دقیقه طول می‌کشد)\n');
const result = spawnSync(
  process.execPath,
  [builder, '--win', '--x64', '--config', 'electron-builder.yml', '--publish', 'never'],
  {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  },
);

if ((result.status ?? 1) === 0) {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const ver = pkg.version || '1.0.0';
  if (!existsSync(path.join(releaseDir, 'latest.yml'))) {
    console.warn('⚠ فایل latest.yml در پوشه release ساخته نشد؛ برای آپدیت خودکار لازم است.');
  }
  console.log('\n✔ ساخت انجام شد. فایل‌ها در پوشه release:');
  console.log(`   • AghrinPishFactor-Setup-${ver}.exe    ← نصب معمولی (با آپدیت خودکار)`);
  console.log(`   • AghrinPishFactor-Portable-${ver}.exe ← اجرای بدون نصب`);
  console.log('   • latest.yml + .blockmap              ← فایل‌های متادیتای آپدیت خودکار\n');
}

process.exit(result.status ?? 1);
