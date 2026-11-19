import { describe, expect, it } from 'vitest';
import {
  calculateItemWeightKg,
  calculateLineTotal,
  calculateQuotationTotals,
  numberToPersianWords,
} from './formatters';

describe('Quotation Financial Calculations', () => {
  it('computes line total = quantity * unitPrice accurately', () => {
    expect(calculateLineTotal(1200, 31800)).toBe(38160000);
    expect(calculateLineTotal(12.5, 40000)).toBe(500000);
    expect(calculateLineTotal(-5, 1000)).toBe(0);
  });

  it('computes grand total = itemsSubtotal + transportCost + vatAmount - discountAmount', () => {
    const items = [
      { unit: 'کیلوگرم' as const, quantity: 1000, weightPerUnitKg: 1, unitPrice: 30000 }, // 30,000,000
      { unit: 'شاخه' as const, quantity: 10, weightPerUnitKg: 190, unitPrice: 6000000 }, // 60,000,000
    ];
    // subtotal = 90,000,000; discount = 5,000,000; taxable = 85,000,000; VAT 10% = 8,500,000; transport = 2,000,000
    // grandTotal = 90,000,000 + 2,000,000 + 8,500,000 - 5,000,000 = 95,500,000
    const result = calculateQuotationTotals(items, true, 10, 2000000, 5000000);
    expect(result.itemsSubtotal).toBe(90000000);
    expect(result.vatAmount).toBe(8500000);
    expect(result.transportCost).toBe(2000000);
    expect(result.discountAmount).toBe(5000000);
    expect(result.grandTotal).toBe(95500000);
    expect(result.totalWeightKg).toBe(2900);
  });

  it('disables VAT cleanly when includeVat is false', () => {
    const items = [{ unit: 'کیلوگرم' as const, quantity: 500, weightPerUnitKg: 1, unitPrice: 40000 }];
    const result = calculateQuotationTotals(items, false, 10, 1000000, 0);
    expect(result.vatAmount).toBe(0);
    expect(result.grandTotal).toBe(21000000);
  });

  it('calculates weights across units correctly', () => {
    expect(calculateItemWeightKg({ unit: 'کیلوگرم', quantity: 500, weightPerUnitKg: 1 })).toBe(500);
    expect(calculateItemWeightKg({ unit: 'تن', quantity: 2.5, weightPerUnitKg: 1 })).toBe(2500);
    expect(calculateItemWeightKg({ unit: 'شاخه', quantity: 20, weightPerUnitKg: 190 })).toBe(3800);
  });
});

describe('Persian Number to Words Converter', () => {
  it('converts zero and small numbers correctly', () => {
    expect(numberToPersianWords(0)).toBe('صفر');
    expect(numberToPersianWords(15)).toBe('پانزده');
    expect(numberToPersianWords(245)).toBe('دویست و چهل و پنج');
  });

  it('converts millions and billions accurately for steel invoices', () => {
    expect(numberToPersianWords(38160000)).toBe('سی و هشت میلیون و صد و شصت هزار');
    expect(numberToPersianWords(1250000000)).toBe('یک میلیارد و دویست و پنجاه میلیون');
  });
});
