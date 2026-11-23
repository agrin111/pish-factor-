import {
  amountInWords,
  formatCurrency,
  formatDocumentNumber,
  formatNumber,
  formatPersianText,
  toEnglishDigits,
  toPersianDigits,
} from '@/lib/format';
import { formatJalali } from '@/lib/jalali';
import { UNIT_LABEL } from '@/lib/labels';
import type { UnitType } from '@prisma/client';

export interface ShareQuotationData {
  id: string;
  number: string;
  issueDate: Date | string;
  validUntil: Date | string;
  validDays: number;
  customerName: string;
  customerMobile: string;
  customerCompany?: string | null;
  currency: 'TOMAN' | 'RIAL';
  grandTotal: string | number;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  companyName: string;
  companyPhone?: string | null;
  smtpConfigured?: boolean;
  items: {
    rowIndex: number;
    productName: string;
    size?: string | null;
    unit: UnitType;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
  }[];
}

/**
 * تبدیل شماره موبایل ایرانی به فرمت بین‌المللی بدون علامت + (مثلاً 989123456789)
 */
export function normalizeIranPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = toEnglishDigits(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0098') && digits.length >= 12) return digits.slice(2);
  if (digits.startsWith('98') && digits.length >= 11) return digits;
  if (digits.startsWith('09') && digits.length === 11) return `98${digits.slice(1)}`;
  if (digits.startsWith('9') && digits.length === 10) return `98${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

export function buildInvoiceShareText(data: ShareQuotationData): string {
  const issue = formatJalali(new Date(data.issueDate));
  const validUntil = formatJalali(new Date(data.validUntil));
  const currencyLabel = data.currency === 'RIAL' ? 'ریال' : 'تومان';

  const lines: string[] = [
    `با سلام، احتراماً پیش‌فاکتور شماره ${formatDocumentNumber(data.number)} از طرف ${formatPersianText(data.companyName)} خدمت شما ارسال می‌گردد:`,
    `مشتری محترم: ${formatPersianText(data.customerName)}${data.customerCompany ? ` (${formatPersianText(data.customerCompany)})` : ''}`,
    `تاریخ صدور: ${issue} | اعتبار تا: ${validUntil} (${formatNumber(data.validDays, 0)} روز)`,
    '',
    'اقلام پیش‌فاکتور:',
  ];

  const previewItems = data.items.slice(0, 15);
  for (const item of previewItems) {
    const unitName = UNIT_LABEL[item.unit] ?? '';
    const sizeText = item.size ? ` (سایز ${formatPersianText(item.size)})` : '';
    lines.push(
      `${formatNumber(item.rowIndex, 0)}. ${formatPersianText(item.productName)}${sizeText} — ${formatNumber(item.quantity, 3)} ${unitName} × ${formatNumber(item.unitPrice, 0)} = ${formatNumber(item.lineTotal, 0)} ${currencyLabel}`,
    );
  }
  if (data.items.length > previewItems.length) {
    lines.push(`... و ${formatNumber(data.items.length - previewItems.length, 0)} ردیف دیگر (جزئیات کامل در فایل PDF پیوست).`);
  }

  lines.push('');
  lines.push(`مبلغ نهایی: ${formatCurrency(data.grandTotal, data.currency)}`);
  lines.push(`به حروف: ${amountInWords(data.grandTotal, data.currency)}`);

  if (data.paymentTerms) {
    lines.push(`شرایط پرداخت: ${formatPersianText(data.paymentTerms)}`);
  }
  if (data.deliveryTerms) {
    lines.push(`شرایط تحویل: ${formatPersianText(data.deliveryTerms)}`);
  }
  if (data.companyPhone) {
    lines.push(`شماره تماس: ${toPersianDigits(data.companyPhone)}`);
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(phoneRaw: string | null | undefined, message: string): string {
  const intl = normalizeIranPhone(phoneRaw);
  const encoded = encodeURIComponent(message);
  return intl ? `https://wa.me/${intl}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildTelegramShareUrl(message: string): string {
  return `https://t.me/share/url?url=&text=${encodeURIComponent(message)}`;
}

export function buildTelegramDirectUrl(phoneRaw: string | null | undefined): string | null {
  const intl = normalizeIranPhone(phoneRaw);
  return intl ? `https://t.me/+${intl}` : null;
}

export function buildBaleUrl(): string {
  return 'https://web.bale.ai';
}

export function buildMailtoUrl(to: string, subject: string, body: string): string {
  const recipient = to.trim().replace(/[\r\n\s]/g, '');
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
