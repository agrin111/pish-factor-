import { describe, expect, it } from 'vitest';
import { sanitizeCsvCell } from '@/lib/csv';
import { effectiveStatus } from '@/lib/quotation-status';
import { addDays, jalaliToDate } from '@/lib/jalali';

describe('ایمن‌سازی خروجی CSV در برابر تزریق فرمول', () => {
  it('پیشوندهای خطرساز اکسل را با آپاستروف خنثی می‌کند', () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+1+1')).toBe('"\'+1+1"');
    expect(sanitizeCsvCell('-1+1')).toBe('"\'-1+1"');
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe('"\'@SUM(A1:A2)"');
    expect(sanitizeCsvCell('  =HYPERLINK("http://x")')).toBe('"\'  =HYPERLINK(""http://x"")"');
  });

  it('مقادیر عادی را بدون تغییر اضافی قالب‌بندی می‌کند', () => {
    expect(sanitizeCsvCell('شرکت آگرین')).toBe('"شرکت آگرین"');
    expect(sanitizeCsvCell(1250000)).toBe('"1250000"');
    expect(sanitizeCsvCell(null)).toBe('""');
  });
});

describe('محاسبه تاریخ انقضای پیش‌فاکتور', () => {
  it('پیش‌فاکتور ارسال‌شده در همان روز تاریخ اعتبار همچنان معتبر می‌ماند', () => {
    const validUntil = jalaliToDate(1405, 9, 5);
    expect(effectiveStatus({ status: 'SENT', validUntil }, validUntil)).toBe('SENT');
  });

  it('پیش‌فاکتور ارسال‌شده از روز بعد از تاریخ اعتبار منقضی می‌شود', () => {
    const validUntil = jalaliToDate(1405, 9, 5);
    const nextDay = addDays(validUntil, 1);
    expect(effectiveStatus({ status: 'SENT', validUntil }, nextDay)).toBe('EXPIRED');
  });

  it('وضعیت‌های تأییدشده و لغوشده با گذشت زمان تغییر نمی‌کنند', () => {
    const validUntil = jalaliToDate(1405, 9, 5);
    const nextDay = addDays(validUntil, 10);
    expect(effectiveStatus({ status: 'APPROVED', validUntil }, nextDay)).toBe('APPROVED');
    expect(effectiveStatus({ status: 'CANCELLED', validUntil }, nextDay)).toBe('CANCELLED');
  });
});
