import type { QuotationStatus } from '@prisma/client';

/**
 * وضعیت مؤثر سند: پیش‌فاکتورهای «ارسال‌شده» که تاریخ اعتبارشان گذشته است
 * به‌صورت خودکار «منقضی‌شده» نمایش داده می‌شوند (بدون تغییر رکورد در دیتابیس).
 */
export function effectiveStatus(quotation: {
  status: QuotationStatus;
  validUntil: Date;
}): QuotationStatus {
  if (
    quotation.status === 'SENT' &&
    quotation.validUntil.getTime() < Date.now()
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
  if (status === 'EXPIRED') {
    return {
      OR: [
        { status: 'EXPIRED' as QuotationStatus },
        { status: 'SENT' as QuotationStatus, validUntil: { lt: new Date() } },
      ],
    };
  }
  if (status === 'SENT') {
    return { status: 'SENT' as QuotationStatus, validUntil: { gte: new Date() } };
  }
  return { status };
}
