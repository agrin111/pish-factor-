import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { computeTotals, dec, roundMoney } from '@/lib/money';
import {
  formatDocumentNumber,
  formatNumber,
  normalizeNumberString,
  numberToPersianWords,
  toNumber,
} from '@/lib/format';

const num = (value: Prisma.Decimal) => Number(value.toString());

describe('محاسبات مالی پیش‌فاکتور', () => {
  it('مبلغ هر ردیف را مقدار × قیمت واحد محاسبه می‌کند', () => {
    const totals = computeTotals({
      items: [
        { quantity: 3, unitPrice: 1_250_000 },
        { quantity: 2.5, unitPrice: 400_000 },
      ],
      includeVat: false,
      vatRate: 0,
      transportCost: 0,
      discountAmount: 0,
    });

    expect(num(totals.itemsSubtotal)).toBe(3_750_000 + 1_000_000);
    expect(num(totals.grandTotal)).toBe(4_750_000);
    expect(totals.itemCount).toBe(2);
  });

  it('فرمول نهایی: جمع کالاها + حمل + مالیات − تخفیف', () => {
    const totals = computeTotals({
      items: [{ quantity: 10, unitPrice: 100_000 }],
      includeVat: true,
      vatRate: 10,
      transportCost: 500_000,
      discountAmount: 300_000,
    });

    // 1,000,000 − 300,000 = 700,000 → مالیات 10% = 70,000
    expect(num(totals.vatAmount)).toBe(70_000);
    expect(num(totals.grandTotal)).toBe(1_000_000 + 500_000 + 70_000 - 300_000);
  });

  it('مالیات غیرفعال است مگر اعمال شود', () => {
    const totals = computeTotals({
      items: [{ quantity: 1, unitPrice: 1_000_000 }],
      includeVat: false,
      vatRate: 10,
      transportCost: 0,
      discountAmount: 0,
    });

    expect(num(totals.vatAmount)).toBe(0);
    expect(num(totals.grandTotal)).toBe(1_000_000);
  });

  it('مبالغ اعشاری به عدد صحیح گرد می‌شوند', () => {
    expect(num(roundMoney(dec('1000.4')))).toBe(1000);
    expect(num(roundMoney(dec('1000.5')))).toBe(1001);
  });

  it('مبلغ نهایی هرگز منفی نمی‌شود', () => {
    const totals = computeTotals({
      items: [{ quantity: 1, unitPrice: 100_000 }],
      includeVat: false,
      vatRate: 0,
      transportCost: 0,
      discountAmount: 500_000,
    });

    expect(num(totals.grandTotal)).toBe(0);
  });

  it('ورودی نامعتبر به صفر تبدیل می‌شود', () => {
    const totals = computeTotals({
      items: [{ quantity: null, unitPrice: 'abc' }],
      includeVat: false,
      vatRate: 0,
      transportCost: 0,
      discountAmount: 0,
    });

    expect(num(totals.grandTotal)).toBe(0);
  });
});

describe('مبلغ به حروف فارسی', () => {
  it('اعداد پایه', () => {
    expect(numberToPersianWords(0)).toBe('صفر');
    expect(numberToPersianWords(7)).toBe('هفت');
    expect(numberToPersianWords(18)).toBe('هجده');
    expect(numberToPersianWords(240)).toBe('دویست و چهل');
  });

  it('هزار و میلیون', () => {
    expect(numberToPersianWords(1_250_000)).toBe('یک میلیون و دویست و پنجاه هزار');
    expect(numberToPersianWords(12_500_000)).toBe('دوازده میلیون و پانصد هزار');
    expect(numberToPersianWords(1_000_000_000)).toBe('یک میلیارد');
  });

  it('قالب‌بندی عدد فارسی', () => {
    expect(formatNumber(1250000, 0)).toContain('۱');
    expect(formatNumber(1250000, 0).replace(/[۰-۹]/g, '')).toMatch(/[٬,]/);
  });
});

describe('ورودی ارقام فارسی', () => {
  it('ارقام فارسی، ممیز عربی و جداکننده هزارگان را به عدد تبدیل می‌کند', () => {
    expect(normalizeNumberString('۱۲۵۰۰۰۰')).toBe('1250000');
    expect(normalizeNumberString('۱٬۲۵۰٬۰۰۰')).toBe('1250000');
    expect(normalizeNumberString('۲٫۵')).toBe('2.5');
    expect(toNumber('۱۲۵۰۰۰۰')).toBe(1_250_000);
    expect(toNumber('۳/۴')).toBe(0);
  });

  it('شماره سند را با ارقام فارسی و پیشوند لاتین نمایش می‌دهد', () => {
    expect(formatDocumentNumber('AG-1405-0001')).toBe('AG-۱۴۰۵-۰۰۰۱');
  });
});
