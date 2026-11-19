/**
 * ایجاد داده‌های اولیه:
 *   - تنظیمات پیش‌فرض شرکت
 *   - حساب مدیر سیستم اولیه
 *   - دسته‌بندی‌های پایه کالا
 *
 * داده‌های نمایشی فقط با متغیر محیطی SEED_DEMO=1 ساخته می‌شوند:
 *   SEED_DEMO=1 npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

const CATEGORIES = [
  { name: 'ورق فولادی', sortOrder: 1 },
  { name: 'پروفیل', sortOrder: 2 },
  { name: 'میلگرد و تیرآهن', sortOrder: 3 },
  { name: 'لوله و اتصالات', sortOrder: 4 },
  { name: 'گالوانیزه', sortOrder: 5 },
];

async function main() {
  const username = (process.env.SEED_ADMIN_USERNAME ?? 'admin').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Aghrin@1404';
  const fullName = process.env.SEED_ADMIN_NAME ?? 'مدیر سیستم';

  await prisma.companySettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      companyName: 'شرکت آهن آگرین',
      currency: 'TOMAN',
      defaultVatRate: 10,
      defaultIncludeVat: false,
      defaultValidDays: 7,
      numberPrefix: 'AG',
      disclaimerText:
        'این پیش‌فاکتور تا تاریخ اعتبار اعلام‌شده معتبر است. مبالغ بر اساس نرخ روز بازار محاسبه شده و تغییر نرخ ارز یا مواد اولیه می‌تواند موجب بازنگری قیمت شود.',
      defaultPaymentTerms: '۵۰٪ پیش‌پرداخت و مابقی هنگام تحویل کالا',
      defaultDeliveryTerms: 'تحویل در محل کارخانه فروشنده — هزینه حمل به عهده خریدار',
    },
    update: {},
  });

  const existingAdmin = await prisma.user.findUnique({ where: { username } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username,
        fullName,
        passwordHash: hashPassword(password),
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`✓ حساب مدیر سیستم ساخته شد — نام کاربری: ${username}`);
    console.log('  رمز عبور اولیه را پس از اولین ورود تغییر دهید.');
  } else {
    console.log(`• کاربر «${username}» از قبل وجود دارد.`);
  }

  for (const category of CATEGORIES) {
    await prisma.productCategory.upsert({
      where: { name: category.name },
      create: category,
      update: {},
    });
  }
  console.log('✓ دسته‌بندی‌های کالا آماده است.');

  if (process.env.SEED_DEMO === '1') {
    const categories = await prisma.productCategory.findMany();
    const byName = (name: string) => categories.find((item) => item.name === name)?.id ?? null;

    const demoProducts = [
      {
        sku: 'ST-1250-G',
        name: 'ورق گالوانیزه ۱۲۵۰',
        categoryId: byName('گالوانیزه'),
        specs: 'گرید ST12 — روکش روی ۱۲۰ گرم',
        size: '۱۲۵۰ میلی‌متر',
        thickness: '۰.۵ میلی‌متر',
        length: '۲۵۰۰ میلی‌متر',
        unit: 'SHEET' as const,
        weightPerUnitKg: 12.5,
        unitPrice: 1250000,
      },
      {
        sku: 'PR-4040',
        name: 'پروفیل قوطی ۴۰×۴۰',
        categoryId: byName('پروفیل'),
        specs: 'ضخامت ۲ میلی‌متر — طول شاخه ۶ متر',
        size: '۴۰×۴۰',
        thickness: '۲ میلی‌متر',
        length: '۶۰۰۰ میلی‌متر',
        unit: 'BRANCH' as const,
        weightPerUnitKg: 14.2,
        unitPrice: 890000,
      },
      {
        sku: 'RB-16',
        name: 'میلگرد آجدار سایز ۱۶',
        categoryId: byName('میلگرد و تیرآهن'),
        specs: 'A3 — کارخانه فولاد',
        size: '۱۶',
        thickness: '',
        length: '۱۲۰۰۰ میلی‌متر',
        unit: 'KILOGRAM' as const,
        weightPerUnitKg: 1,
        unitPrice: 42000,
      },
      {
        sku: 'IP-14',
        name: 'تیرآهن ۱۴',
        categoryId: byName('میلگرد و تیرآهن'),
        specs: 'IPE — طول شاخه ۱۲ متر',
        size: '۱۴',
        thickness: '',
        length: '۱۲۰۰۰ میلی‌متر',
        unit: 'KILOGRAM' as const,
        weightPerUnitKg: 1,
        unitPrice: 45500,
      },
    ];

    for (const product of demoProducts) {
      await prisma.product.upsert({
        where: { sku: product.sku },
        create: { ...product, description: 'داده نمایشی محیط توسعه' },
        update: {},
      });
    }

    const admin = await prisma.user.findUnique({ where: { username } });
    if (admin) {
      const demoCustomer = await prisma.customer.findFirst({ where: { mobile: '09120000000' } });
      if (!demoCustomer) {
        await prisma.customer.create({
          data: {
            name: 'مشتری نمونه',
            mobile: '09120000000',
            companyOrProject: 'پروژه نمایشی',
            customerType: 'COMPANY',
            city: 'تهران',
            address: 'تهران، خیابان نمونه',
            notes: 'داده نمایشی محیط توسعه',
            createdById: admin.id,
          },
        });
      }
    }

    console.log('✓ داده‌های نمایشی (SEED_DEMO=1) ساخته شد.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
