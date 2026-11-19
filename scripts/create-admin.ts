/**
 * ساخت یا بازنشانی حساب مدیر سیستم از خط فرمان:
 *
 *   npm run admin:create -- <username> <password> "نام و نام خانوادگی"
 *
 * اگر رمز وارد نشود، رمز تصادفی ساخته و چاپ می‌شود.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function main() {
  const [, , usernameArg, passwordArg, ...nameParts] = process.argv;
  const username = (usernameArg ?? '').trim().toLowerCase();
  const fullName = nameParts.join(' ').trim() || 'مدیر سیستم';

  if (!username) {
    console.error('استفاده: npm run admin:create -- <username> <password> "نام و نام خانوادگی"');
    process.exit(1);
  }

  const password = passwordArg || randomBytes(6).toString('base64url');

  if (password.length < 8) {
    console.error('رمز عبور باید حداقل ۸ کاراکتر باشد.');
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      fullName,
      passwordHash: hashPassword(password),
      role: 'ADMIN',
      isActive: true,
    },
    update: {
      role: 'ADMIN',
      isActive: true,
      passwordHash: hashPassword(password),
    },
  });

  await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log('✓ حساب مدیر سیستم آماده است.');
  console.log(`  نام کاربری: ${user.username}`);
  console.log(`  رمز عبور:   ${password}`);
  console.log('  این رمز را در جای امن نگه دارید و پس از ورود تغییر دهید.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
