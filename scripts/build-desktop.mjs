/**
 * ساخت نصب‌کننده ویندوز (Aghrin PishFactor Setup .exe)
 *
 *   npm run build          # ابتدا بیلد Next.js
 *   npm run desktop:build  # سپس بسته‌بندی ویندوز
 *
 * نکته مهم: این اسکریپت باید روی ویندوز اجرا شود؛ چون باینری‌های PostgreSQL
 * همراه برنامه و موتور Prisma برای ویندوز در همان محیط نصب می‌شوند.
 */
import { cpSync, existsSync, readFileSync, readdirSync } from 'node:fs';
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
  console.log('\n✔ ساخت انجام شد. فایل‌ها در پوشه release:');
  console.log('   • AghrinPishFactor-Setup-1.0.0.exe    ← نصب معمولی');
  console.log('   • AghrinPishFactor-Portable-1.0.0.exe ← اجرای بدون نصب\n');
}

process.exit(result.status ?? 1);
