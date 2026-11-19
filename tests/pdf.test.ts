import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fa, renderQuotationPdf } from '@/lib/pdf';
import { jalaliToDate } from '@/lib/jalali';

describe('آماده‌سازی متن فارسی برای PDF', () => {
  it('نشانه‌های لاتین و عددی را برای موتور PDF برعکس می‌کند', () => {
    expect(fa('شماره AG-1001')).toContain('1001-GA');
    expect(fa('۱۴۰۵/۰۸/۲۸')).toBe('۸۲/۸۰/۵۰۴۱');
  });

  it('متن بدون حرف فارسی دست‌نخورده می‌ماند', () => {
    expect(fa('AG-1001')).toBe('AG-1001');
    expect(fa('09120000000')).toBe('09120000000');
  });

  it('پرانتزها را آینه می‌کند', () => {
    expect(fa('(نمونه)')).toBe(')نمونه(');
  });

  it('متن خالی را مدیریت می‌کند', () => {
    expect(fa(null)).toBe('');
    expect(fa(undefined)).toBe('');
  });
});

describe('تولید فایل PDF', () => {
  it('یک فایل PDF معتبر با فونت فارسی می‌سازد', async () => {
    const fontRegular = path.join(process.cwd(), 'assets/fonts/Vazirmatn-Regular.ttf');
    expect(fs.existsSync(fontRegular)).toBe(true);

    const issueDate = jalaliToDate(1405, 8, 28);
    const pdf = await renderQuotationPdf(
      {
        id: 'test',
        number: 'AG-1405-0001',
        issueDate,
        validUntil: jalaliToDate(1405, 9, 5),
        validDays: 7,
        status: 'SENT',
        customerId: 'c1',
        customerName: 'شرکت نمونه ساختمانی',
        customerMobile: '09120000000',
        customerCompany: 'پروژه نمونه',
        customerAddress: 'تهران، خیابان نمونه',
        currency: 'TOMAN',
        includeVat: true,
        vatRate: new (await import('@prisma/client')).Prisma.Decimal(10),
        itemsSubtotal: new (await import('@prisma/client')).Prisma.Decimal(1_000_000),
        transportCost: new (await import('@prisma/client')).Prisma.Decimal(50_000),
        discountAmount: new (await import('@prisma/client')).Prisma.Decimal(0),
        vatAmount: new (await import('@prisma/client')).Prisma.Decimal(100_000),
        grandTotal: new (await import('@prisma/client')).Prisma.Decimal(1_150_000),
        totalWeightKg: new (await import('@prisma/client')).Prisma.Decimal(10),
        itemCount: 1,
        paymentTerms: '۵۰٪ پیش‌پرداخت',
        deliveryTerms: 'تحویل در محل کارخانه',
        notes: null,
        createdById: 'u1',
        createdAt: issueDate,
        updatedAt: issueDate,
        items: [
          {
            id: 'i1',
            quotationId: 'test',
            rowIndex: 1,
            productId: null,
            sku: null,
            productName: 'ورق گالوانیزه',
            specs: 'گرید ST12',
            size: '۱۲۵۰',
            unit: 'SHEET',
            quantity: new (await import('@prisma/client')).Prisma.Decimal(2),
            unitPrice: new (await import('@prisma/client')).Prisma.Decimal(500_000),
            lineTotal: new (await import('@prisma/client')).Prisma.Decimal(1_000_000),
            weightKg: new (await import('@prisma/client')).Prisma.Decimal(10),
          },
        ],
      },
      {
        id: 1,
        companyName: 'شرکت آهن آگرین',
        subtitle: null,
        logoDataUrl: null,
        phone: '02100000000',
        secondaryPhone: null,
        email: null,
        website: null,
        address: 'تهران',
        nationalId: '12345678901',
        economicCode: '411111111111',
        registrationNo: null,
        bankInfo: null,
        defaultPaymentTerms: null,
        defaultDeliveryTerms: null,
        defaultNotes: null,
        disclaimerText: 'این پیش‌فاکتور تا تاریخ اعتبار معتبر است.',
        currency: 'TOMAN',
        defaultVatRate: new (await import('@prisma/client')).Prisma.Decimal(10),
        defaultIncludeVat: false,
        defaultValidDays: 7,
        numberPrefix: 'AG',
        updatedAt: issueDate,
      },
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(3000);
  });
});
