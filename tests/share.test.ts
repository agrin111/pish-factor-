import { describe, expect, it } from 'vitest';
import {
  buildBaleUrl,
  buildInvoiceShareText,
  buildMailtoUrl,
  buildTelegramDirectUrl,
  buildTelegramShareUrl,
  buildWhatsAppUrl,
  normalizeIranPhone,
} from '@/lib/share';

describe('ابزارهای اشتراک‌گذاری پیش‌فاکتور', () => {
  it('شماره موبایل ایرانی را با ارقام فارسی یا لاتین به فرمت بین‌المللی تبدیل می‌کند', () => {
    expect(normalizeIranPhone('09123456789')).toBe('989123456789');
    expect(normalizeIranPhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('989123456789');
    expect(normalizeIranPhone('+98 912 345 6789')).toBe('989123456789');
    expect(normalizeIranPhone('9123456789')).toBe('989123456789');
    expect(normalizeIranPhone('123')).toBeNull();
  });

  it('لینک‌های واتساپ، تلگرام، بله و ایمیل را درست می‌سازد', () => {
    const wa = buildWhatsAppUrl('۰۹۱۲۳۴۵۶۷۸۹', 'سلام');
    expect(wa).toContain('https://wa.me/989123456789?text=');

    const tg = buildTelegramShareUrl('متن پیش‌فاکتور');
    expect(tg).toContain('https://t.me/share/url');

    expect(buildTelegramDirectUrl('09123456789')).toBe('https://t.me/+989123456789');
    expect(buildBaleUrl()).toBe('https://web.bale.ai');

    const mailto = buildMailtoUrl('test@example.com', 'موضوع', 'متن');
    expect(mailto).toContain('mailto:test@example.com?subject=');
  });

  it('متن کامل پیش‌فاکتور را با اقلام و جمع نهایی تولید می‌کند', () => {
    const text = buildInvoiceShareText({
      id: 'q1',
      number: 'AG-1405-0001',
      issueDate: '2026-11-19T00:00:00.000Z',
      validUntil: '2026-11-26T00:00:00.000Z',
      validDays: 7,
      customerName: 'علی رضایی',
      customerMobile: '09120000000',
      customerCompany: 'شرکت ساختمانی آگرین',
      currency: 'TOMAN',
      grandTotal: '1250000',
      paymentTerms: 'نقدی',
      deliveryTerms: 'تحویل انبار',
      companyName: 'شرکت آهن آگرین',
      companyPhone: '02112345678',
      items: [
        {
          rowIndex: 1,
          productName: 'میلگرد ۱۶',
          size: '۱۶',
          unit: 'KILOGRAM',
          quantity: '100',
          unitPrice: '12500',
          lineTotal: '1250000',
        },
      ],
    });

    expect(text).toContain('علی رضایی');
    expect(text).toContain('میلگرد ۱۶');
    expect(text).toContain('شرکت آهن آگرین');
    expect(text).toContain('نقدی');
    expect(text).toContain('AG-۱۴۰۵-۰۰۰۱');
    expect(text).toContain('۰۲۱۱۲۳۴۵۶۷۸');
    expect(text).not.toMatch(/[0-9]/);
  });
});
