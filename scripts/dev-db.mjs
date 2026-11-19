/**
 * اجرای یک سرور PostgreSQL محلی برای محیط توسعه، بدون نیاز به نصب سیستمی.
 * داده‌ها در پوشه .devdb نگهداری می‌شوند و با هر بار اجرا حفظ می‌شوند.
 *
 *   npm run db:dev
 *
 * سپس در فایل .env:
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/pishfactor?schema=public"
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const port = Number(process.env.DEV_DB_PORT ?? 5433);
const databaseDir = './.devdb';
const firstRun = !existsSync(databaseDir);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
});

if (firstRun) {
  console.log('در حال آماده‌سازی دیتابیس توسعه در', databaseDir);
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase('pishfactor');
  console.log('دیتابیس pishfactor ساخته شد.');
} catch {
  // دیتابیس از قبل وجود دارد
}

console.log(`PostgreSQL روی پورت ${port} آماده است. برای توقف Ctrl+C را بزنید.`);
console.log(`DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${port}/pishfactor?schema=public"`);

const shutdown = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// پروسه سرور را زنده نگه می‌دارد
await new Promise(() => {});
