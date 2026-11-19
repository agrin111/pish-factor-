/** قالب‌بندی اعداد و مبالغ — بدون وابستگی به سمت سرور، قابل استفاده در کلاینت و سرور. */

const FA_NUMBER = new Intl.NumberFormat('fa-IR');

export const CURRENCY_LABEL: Record<string, string> = {
  TOMAN: 'تومان',
  RIAL: 'ریال',
};

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatNumber(value: unknown, maxFractionDigits = 3): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: maxFractionDigits }).format(
    toNumber(value),
  );
}

export function formatCurrency(value: unknown, currency: string): string {
  return `${FA_NUMBER.format(Math.round(toNumber(value)))} ${CURRENCY_LABEL[currency] ?? 'تومان'}`;
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];

function threeDigitsToWords(num: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(num / 100);
  const rest = num % 100;

  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);

  if (rest >= 10 && rest <= 19) {
    parts.push(TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens > 0) parts.push(TENS[tens]);
    if (ones > 0) parts.push(ONES[ones]);
  }

  return parts.join(' و ');
}

export function numberToPersianWords(value: unknown): string {
  const num = Math.max(0, Math.round(toNumber(value)));
  if (num === 0) return 'صفر';

  const groups: number[] = [];
  let rest = num;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i] === 0) continue;
    const chunk = threeDigitsToWords(groups[i]);
    const scale = SCALES[i] ?? '';
    words.push(scale ? `${chunk} ${scale}` : chunk);
  }

  return words.join(' و ');
}

export function amountInWords(value: unknown, currency: string): string {
  return `${numberToPersianWords(value)} ${CURRENCY_LABEL[currency] ?? 'تومان'}`;
}
