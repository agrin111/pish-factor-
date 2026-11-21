/**
 * ساخت نصب‌کننده ویندوز (Aghrin PishFactor Setup .exe)
 *
 *   npm run build          # ابتدا بیلد Next.js
 *   npm run desktop:build  # سپس بسته‌بندی ویندوز
 *
 * نکته مهم: این اسکریپت باید روی ویندوز اجرا شود؛ چون باینری‌های PostgreSQL
 * همراه برنامه و موتور Prisma برای ویندوز در همان محیط نصب می‌شوند.
 */
import { cpSync, existsSync, readdirSync } from 'node:fs';
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

const migrations = path.join(root, 'prisma', 'migrations');
const migrationDirs = readdirSync(migrations, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
if (migrationDirs.length === 0) fail('هیچ migration‌ای در prisma/migrations پیدا نشد.');
console.log(`✔ ${migrationDirs.length} migration برای اولین اجرا آماده است`);

if (process.platform !== 'win32') {
  console.warn(
    '\n⚠ این اسکریپت برای ساخت نصب‌کننده ویندوز طراحی شده است. ساخت نسخه ویندوزی از لینوکس/مک\n' +
      '  قابل اطمینان نیست، چون باینری‌های PostgreSQL و موتور Prisma مخصوص ویندوز باید همراه بسته شوند.\n' +
      '  روی ویندوز اجرا کنید یا از گردش‌کار GitHub Actions (.github/workflows/windows-installer.yml) استفاده کنید.\n',
  );
}

if (!existsSync(path.join(root, 'node_modules', '@embedded-postgres', 'windows-x64'))) {
  console.warn(
    '⚠ بسته باینری PostgreSQL ویندوز نصب نیست. روی ویندوز دستور «npm install» این بسته را نصب می‌کند.',
  );
}

const builder = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
if (!existsSync(builder)) {
  fail('electron-builder نصب نیست. «npm install» را اجرا کنید.');
}

const result = spawnSync(
  process.execPath,
  [builder, '--win', 'nsis', '--x64', '--config', 'electron-builder.yml', '--publish', 'never'],
  { stdio: 'inherit', cwd: root },
);

process.exit(result.status ?? 1);
