import type { QuotationStatus } from '@prisma/client';
import { todayUtc } from '@/lib/jalali';

/**
 * وضعیت مؤثر سند: پیش‌فاکتورهای «ارسال‌شده» که تاریخ اعتبارشان گذشته است
 * به‌صورت خودکار «منقضی‌شده» نمایش داده می‌شوند (بدون تغییر رکورد در دیتابیس).
 * سند تا پایان روز تاریخ اعتبار معتبر است و از روز بعد منقضی محسوب می‌شود.
 */
export function effectiveStatus(
  quotation: {
    status: QuotationStatus;
    validUntil: Date;
  },
  referenceDate: Date = todayUtc(),
): QuotationStatus {
  if (
    quotation.status === 'SENT' &&
    quotation.validUntil.getTime() < referenceDate.getTime()
  ) {
    return 'EXPIRED';
  }
  return quotation.status;
}

export function isExpired(quotation: { status: QuotationStatus; validUntil: Date }): boolean {
  return effectiveStatus(quotation) === 'EXPIRED';
}

/** فیلتر Prisma معادل وضعیت مؤثر */
export function statusWhere(status: QuotationStatus) {
  const today = todayUtc();
  if (status === 'EXPIRED') {
    return {
      OR: [
        { status: 'EXPIRED' as QuotationStatus },
        { status: 'SENT' as QuotationStatus, validUntil: { lt: today } },
      ],
    };
  }
  if (status === 'SENT') {
    return { status: 'SENT' as QuotationStatus, validUntil: { gte: today } };
  }
  return { status };
}
