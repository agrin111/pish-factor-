import { formatJalali } from '@/lib/jalali';

export interface PdfFileNameInput {
  customerName?: string | null;
  issueDate?: Date | string | null;
  documentNumber?: string | null;
  paperSize?: 'A4' | 'A5';
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ساخت نام فایل PDF بر اساس نام مشتری و تاریخ پیش‌فاکتور (شمسی)
 */
export function buildInvoicePdfFileName({
  customerName,
  issueDate,
  documentNumber,
  paperSize,
}: PdfFileNameInput): string {
  const safeCustomer = sanitizeFilenamePart(customerName ?? '')
    .slice(0, 60)
    .trim();

  let safeDate = '';
  if (issueDate) {
    const parsed = issueDate instanceof Date ? issueDate : new Date(issueDate);
    if (!Number.isNaN(parsed.getTime())) {
      safeDate = formatJalali(parsed).replace(/\//g, '-');
    }
  }

  const safeNumber = sanitizeFilenamePart(documentNumber ?? '');
  const parts: string[] = [];

  if (safeCustomer) parts.push(safeCustomer);
  if (safeDate) parts.push(safeDate);
  if (parts.length === 0 && safeNumber) parts.push(`invoice-${safeNumber}`);
  if (parts.length === 0) parts.push('invoice');
  if (paperSize === 'A5') parts.push('A5');

  return `${parts.join(' - ')}.pdf`;
}

export function parseContentDispositionFileName(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const utf8Match = /filename\*=UTF-8''([^;\r\n]+)/i.exec(headerValue);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      /* ignore malformed encoding */
    }
  }
  const plainMatch = /filename="([^"\r\n]+)"/i.exec(headerValue);
  return plainMatch?.[1]?.trim() || null;
}
