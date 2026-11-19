import { CurrencyType, QuotationItem } from '../types';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );
}

export function formatCurrency(value: number, currency: CurrencyType = 'تومان'): string {
  const safeVal = Number.isFinite(value) ? Math.round(value) : 0;
  return `${new Intl.NumberFormat('fa-IR').format(safeVal)} ${currency}`;
}

export function getShamsiDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return '۱۴۰۵/۰۸/۲۸';
  }
}

export function addDaysShamsi(days: number, baseDate: Date = new Date()): string {
  const target = new Date(baseDate.getTime());
  target.setDate(target.getDate() + Math.max(0, Math.round(days)));
  return getShamsiDate(target);
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  const q = Math.max(0, Number.isFinite(quantity) ? quantity : 0);
  const p = Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0);
  return Math.round(q * p);
}

export function calculateItemWeightKg(item: Pick<QuotationItem, 'unit' | 'quantity' | 'weightPerUnitKg'>): number {
  const q = Math.max(0, Number.isFinite(item.quantity) ? item.quantity : 0);
  const w = Math.max(0, Number.isFinite(item.weightPerUnitKg) ? item.weightPerUnitKg : 0);
  if (item.unit === 'کیلوگرم') return Math.round(q * 100) / 100;
  if (item.unit === 'تن') return Math.round(q * 1000 * 100) / 100;
  return Math.round(q * w * 100) / 100;
}

export interface ComputedQuotationTotals {
  itemsSubtotal: number;
  transportCost: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
  totalWeightKg: number;
}

/**
 * فرمول مصوب محاسبات مالی پیش‌فاکتور:
 * مبلغ هر ردیف = مقدار × قیمت واحد
 * جمع کل کالاها = مجموع مبالغ ردیف‌ها
 * مبلغ نهایی = جمع کالاها + هزینه حمل + مالیات - تخفیف
 */
export function calculateQuotationTotals(
  items: Pick<QuotationItem, 'unit' | 'quantity' | 'weightPerUnitKg' | 'unitPrice'>[],
  includeVat: boolean,
  vatRate: number,
  transportCost: number,
  discountAmount: number
): ComputedQuotationTotals {
  let itemsSubtotal = 0;
  let totalWeightKg = 0;

  for (const item of items) {
    itemsSubtotal += calculateLineTotal(item.quantity, item.unitPrice);
    totalWeightKg += calculateItemWeightKg(item);
  }

  const safeTransport = Math.max(0, Math.round(Number.isFinite(transportCost) ? transportCost : 0));
  const safeDiscount = Math.max(0, Math.round(Number.isFinite(discountAmount) ? discountAmount : 0));
  const safeVatRate = Math.max(0, Number.isFinite(vatRate) ? vatRate : 0);

  const taxableBase = Math.max(0, itemsSubtotal - safeDiscount);
  const vatAmount = includeVat ? Math.round(taxableBase * (safeVatRate / 100)) : 0;
  const grandTotal = Math.max(0, itemsSubtotal + safeTransport + vatAmount - safeDiscount);

  return {
    itemsSubtotal,
    transportCost: safeTransport,
    discountAmount: safeDiscount,
    vatAmount,
    grandTotal,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
  };
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = [
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = [
  '',
  'صد',
  'دویست',
  'سیصد',
  'چهارصد',
  'پانصد',
  'ششصد',
  'هفتصد',
  'هشتصد',
  'نهصد',
];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];

function convertThreeDigits(num: number): string {
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;

  if (h > 0) parts.push(HUNDREDS[h]);

  if (rem >= 10 && rem <= 19) {
    parts.push(TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) parts.push(TENS[t]);
    if (o > 0) parts.push(ONES[o]);
  }

  return parts.join(' و ');
}

export function numberToPersianWords(value: number): string {
  const num = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  if (num === 0) return 'صفر';

  const groups: number[] = [];
  let temp = num;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal === 0) continue;
    const chunk = convertThreeDigits(groupVal);
    const scale = SCALES[i] || '';
    words.push(scale ? `${chunk} ${scale}` : chunk);
  }

  return words.join(' و ');
}

export function sanitizeStr(val: string | undefined, maxLength: number): string {
  return (val ?? '').trim().slice(0, maxLength);
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 6);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJsonBackup(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
