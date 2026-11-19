import { Prisma } from '@prisma/client';
import {
  amountInWords,
  formatCurrency as formatCurrencyValue,
  formatNumber as formatNumberValue,
  numberToPersianWords,
} from '@/lib/format';

export { amountInWords, numberToPersianWords };
export const CURRENCY_LABEL = { TOMAN: 'تومان', RIAL: 'ریال' } as Record<string, string>;

export type DecimalInput = Prisma.Decimal | string | number | null | undefined;

export function dec(value: DecimalInput): Prisma.Decimal {
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(0);
  try {
    return new Prisma.Decimal(value as Prisma.Decimal.Value);
  } catch {
    return new Prisma.Decimal(0);
  }
}

/** گرد کردن مبالغ به نزدیک‌ترین عدد صحیح (تومان/ریال). */
export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundQty(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

export interface TotalsInput {
  items: { quantity: DecimalInput; unitPrice: DecimalInput }[];
  includeVat: boolean;
  vatRate: DecimalInput;
  transportCost: DecimalInput;
  discountAmount: DecimalInput;
}

export interface TotalsResult {
  itemsSubtotal: Prisma.Decimal;
  transportCost: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  itemCount: number;
}

/**
 * فرمول مصوب محاسبات مالی:
 *   مبلغ ردیف  = مقدار × قیمت واحد
 *   جمع کالاها = مجموع مبالغ ردیف‌ها
 *   مبلغ نهایی = جمع کالاها + هزینه حمل + مالیات − تخفیف
 */
export function computeTotals(input: TotalsInput): TotalsResult {
  let itemsSubtotal = new Prisma.Decimal(0);

  for (const item of input.items) {
    const quantity = dec(item.quantity);
    const unitPrice = dec(item.unitPrice);
    itemsSubtotal = itemsSubtotal.add(roundMoney(quantity.mul(unitPrice)));
  }

  itemsSubtotal = roundMoney(itemsSubtotal);

  const transportCost = roundMoney(dec(input.transportCost));
  const discountAmount = roundMoney(dec(input.discountAmount));
  const vatRate = dec(input.vatRate).toDecimalPlaces(2);

  const taxableBase = Prisma.Decimal.max(0, itemsSubtotal.sub(discountAmount));
  const vatAmount = input.includeVat
    ? roundMoney(taxableBase.mul(vatRate).div(100))
    : new Prisma.Decimal(0);

  const grandTotal = roundMoney(
    Prisma.Decimal.max(
      0,
      itemsSubtotal.add(transportCost).add(vatAmount).sub(discountAmount),
    ),
  );

  return {
    itemsSubtotal,
    transportCost,
    discountAmount,
    vatRate,
    vatAmount,
    grandTotal,
    itemCount: input.items.length,
  };
}

export function formatNumber(value: DecimalInput, maxFractionDigits = 3): string {
  return formatNumberValue(value?.toString() ?? 0, maxFractionDigits);
}

export function formatCurrency(value: DecimalInput, currency: string): string {
  return formatCurrencyValue(Math.round(Number(roundMoney(dec(value)).toString())), currency);
}
