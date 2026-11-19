import { prisma } from '@/lib/db';
import { currentJalaliYear } from '@/lib/jalali';
import type { Prisma } from '@prisma/client';

/**
 * تولید اتمیک شماره پیش‌فاکتور.
 * از UPDATE ... RETURNING داخل تراکنش استفاده می‌کند تا در درخواست‌های هم‌زمان
 * شماره تکراری تولید نشود (قید UNIQUE روی ستون number نیز محافظ دوم است).
 */
export async function nextQuotationNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
): Promise<string> {
  const year = currentJalaliYear();
  const key = `quotation-${year}-${prefix}`;

  await tx.numberSequence.upsert({
    where: { key },
    create: { key, value: 0 },
    update: {},
  });

  const rows = await tx.$queryRaw<{ value: number }[]>`
    UPDATE "NumberSequence"
       SET value = value + 1, "updatedAt" = NOW()
     WHERE key = ${key}
    RETURNING value
  `;

  const seq = rows[0]?.value ?? 1;
  return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
}

/** شماره موقت برای پیش‌نویس‌هایی که هنوز شماره نهایی نگرفته‌اند */
export async function nextDraftNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
): Promise<string> {
  const number = await nextQuotationNumber(tx, prefix);
  return number;
}

export async function getNextNumberPreview(prefix: string): Promise<string> {
  const year = currentJalaliYear();
  const key = `quotation-${year}-${prefix}`;
  const row = await prisma.numberSequence.findUnique({ where: { key } });
  const next = (row?.value ?? 0) + 1;
  return `${prefix}-${year}-${next.toString().padStart(4, '0')}`;
}
