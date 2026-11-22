import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fa, renderQuotationPdf } from '@/lib/pdf';
import { buildInvoicePdfFileName, parseContentDispositionFileName } from '@/lib/pdf-filename';
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
        customerPhone: '02188001122',
        customerCompany: 'پروژه نمونه',
        customerNationalId: '10101234567',
        customerEconomicCode: '411122233344',
        customerCity: 'تهران',
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
        letterheadType: 'MAIN',
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
        miscCompanyName: 'فروش متفرقه آگرین',
        miscSubtitle: 'واحد فروش آزاد',
        miscLogoDataUrl: null,
        miscPhone: '02199999999',
        miscSecondaryPhone: null,
        miscEmail: null,
        miscWebsite: null,
        miscAddress: 'تهران، انبار شماره ۲',
        miscNationalId: null,
        miscEconomicCode: null,
        miscRegistrationNo: null,
        miscBankInfo: 'بانک ملت ۱۲۳۴۵',
        smtpHost: null,
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: null,
        smtpPass: null,
        smtpFrom: null,
        updatedAt: issueDate,
      },
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it('فایل PDF با سربرگ متفرقه نیز معتبر تولید می‌شود', async () => {
    const issueDate = jalaliToDate(1405, 8, 28);
    const { Prisma } = await import('@prisma/client');
    const pdf = await renderQuotationPdf(
      {
        id: 'test-misc',
        number: 'AG-1405-0002',
        issueDate,
        validUntil: jalaliToDate(1405, 9, 5),
        validDays: 7,
        status: 'DRAFT',
        customerId: 'c1',
        customerName: 'خریدار متفرقه',
        customerMobile: '09120000000',
        customerPhone: null,
        customerCompany: null,
        customerNationalId: null,
        customerEconomicCode: null,
        customerCity: null,
        customerAddress: null,
        currency: 'RIAL',
        includeVat: false,
        vatRate: new Prisma.Decimal(0),
        itemsSubtotal: new Prisma.Decimal(500_000),
        transportCost: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        vatAmount: new Prisma.Decimal(0),
        grandTotal: new Prisma.Decimal(500_000),
        totalWeightKg: new Prisma.Decimal(10),
        itemCount: 1,
        paymentTerms: null,
        deliveryTerms: null,
        notes: null,
        letterheadType: 'MISC',
        createdById: 'u1',
        createdAt: issueDate,
        updatedAt: issueDate,
        items: [
          {
            id: 'i1',
            quotationId: 'test-misc',
            rowIndex: 1,
            productId: null,
            sku: null,
            productName: 'میلگرد ۱۶',
            specs: null,
            size: '۱۶',
            unit: 'KILOGRAM',
            quantity: new Prisma.Decimal(10),
            unitPrice: new Prisma.Decimal(50_000),
            lineTotal: new Prisma.Decimal(500_000),
            weightKg: new Prisma.Decimal(10),
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
        disclaimerText: null,
        currency: 'RIAL',
        defaultVatRate: new Prisma.Decimal(10),
        defaultIncludeVat: false,
        defaultValidDays: 7,
        numberPrefix: 'AG',
        miscCompanyName: 'فروش متفرقه آگرین',
        miscSubtitle: 'واحد فروش آزاد',
        miscLogoDataUrl: null,
        miscPhone: '02199999999',
        miscSecondaryPhone: null,
        miscEmail: null,
        miscWebsite: null,
        miscAddress: 'انبار غرب',
        miscNationalId: null,
        miscEconomicCode: null,
        miscRegistrationNo: null,
        miscBankInfo: null,
        smtpHost: null,
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: null,
        smtpPass: null,
        smtpFrom: null,
        updatedAt: issueDate,
      },
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it('فایل PDF در اندازه برگه A5 نیز معتبر تولید می‌شود', async () => {
    const issueDate = jalaliToDate(1405, 8, 28);
    const { Prisma } = await import('@prisma/client');
    const pdf = await renderQuotationPdf(
      {
        id: 'test-a5',
        number: 'AG-1405-0003',
        issueDate,
        validUntil: jalaliToDate(1405, 9, 5),
        validDays: 7,
        status: 'APPROVED',
        customerId: 'c1',
        customerName: 'مشتری برگه A5',
        customerMobile: '09120000000',
        customerPhone: null,
        customerCompany: 'پروژه آگرین',
        customerNationalId: null,
        customerEconomicCode: null,
        customerCity: 'اصفهان',
        customerAddress: 'تهران',
        currency: 'TOMAN',
        includeVat: true,
        vatRate: new Prisma.Decimal(10),
        itemsSubtotal: new Prisma.Decimal(1_000_000),
        transportCost: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        vatAmount: new Prisma.Decimal(100_000),
        grandTotal: new Prisma.Decimal(1_100_000),
        totalWeightKg: new Prisma.Decimal(10),
        itemCount: 1,
        paymentTerms: 'نقدی',
        deliveryTerms: 'تحویل در انبار',
        notes: null,
        letterheadType: 'MAIN',
        createdById: 'u1',
        createdAt: issueDate,
        updatedAt: issueDate,
        items: [
          {
            id: 'i1',
            quotationId: 'test-a5',
            rowIndex: 1,
            productId: null,
            sku: null,
            productName: 'تیرآهن ۱۸',
            specs: 'ذوب آهن اصفهان',
            size: '۱۸',
            unit: 'BRANCH',
            quantity: new Prisma.Decimal(2),
            unitPrice: new Prisma.Decimal(500_000),
            lineTotal: new Prisma.Decimal(1_000_000),
            weightKg: new Prisma.Decimal(10),
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
        disclaimerText: null,
        currency: 'TOMAN',
        defaultVatRate: new Prisma.Decimal(10),
        defaultIncludeVat: false,
        defaultValidDays: 7,
        numberPrefix: 'AG',
        miscCompanyName: null,
        miscSubtitle: null,
        miscLogoDataUrl: null,
        miscPhone: null,
        miscSecondaryPhone: null,
        miscEmail: null,
        miscWebsite: null,
        miscAddress: null,
        miscNationalId: null,
        miscEconomicCode: null,
        miscRegistrationNo: null,
        miscBankInfo: null,
        smtpHost: null,
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: null,
        smtpPass: null,
        smtpFrom: null,
        updatedAt: issueDate,
      },
      { paperSize: 'A5' },
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(3000);
  });

  it('پیش‌فاکتورهای بالای ۴۰ ردیف را بدون حذف اقلام و در چند صفحه تولید می‌کند', async () => {
    const issueDate = jalaliToDate(1405, 8, 28);
    const { Prisma } = await import('@prisma/client');
    const items = Array.from({ length: 50 }, (_, idx) => ({
      id: `i-${idx + 1}`,
      quotationId: 'test-multi',
      rowIndex: idx + 1,
      productId: null,
      sku: `SKU-${idx + 1}`,
      productName: `میلگرد سایز ${idx + 1}`,
      specs: 'ذوب آهن',
      size: '۱۶',
      unit: 'KILOGRAM' as const,
      quantity: new Prisma.Decimal(100),
      unitPrice: new Prisma.Decimal(50_000),
      lineTotal: new Prisma.Decimal(5_000_000),
      weightKg: new Prisma.Decimal(100),
    }));

    const pdf = await renderQuotationPdf(
      {
        id: 'test-multi',
        number: 'AG-1405-0099',
        issueDate,
        validUntil: jalaliToDate(1405, 9, 5),
        validDays: 7,
        status: 'SENT',
        customerId: 'c1',
        customerName: 'مشتری پرردیف',
        customerMobile: '09120000000',
        customerPhone: null,
        customerCompany: null,
        customerNationalId: null,
        customerEconomicCode: null,
        customerCity: null,
        customerAddress: null,
        currency: 'TOMAN',
        includeVat: false,
        vatRate: new Prisma.Decimal(0),
        itemsSubtotal: new Prisma.Decimal(250_000_000),
        transportCost: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        vatAmount: new Prisma.Decimal(0),
        grandTotal: new Prisma.Decimal(250_000_000),
        totalWeightKg: new Prisma.Decimal(5000),
        itemCount: 50,
        paymentTerms: null,
        deliveryTerms: null,
        notes: null,
        letterheadType: 'MAIN',
        createdById: 'u1',
        createdAt: issueDate,
        updatedAt: issueDate,
        items,
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
        nationalId: null,
        economicCode: null,
        registrationNo: null,
        bankInfo: null,
        defaultPaymentTerms: null,
        defaultDeliveryTerms: null,
        defaultNotes: null,
        disclaimerText: null,
        currency: 'TOMAN',
        defaultVatRate: new Prisma.Decimal(10),
        defaultIncludeVat: false,
        defaultValidDays: 7,
        numberPrefix: 'AG',
        miscCompanyName: null,
        miscSubtitle: null,
        miscLogoDataUrl: null,
        miscPhone: null,
        miscSecondaryPhone: null,
        miscEmail: null,
        miscWebsite: null,
        miscAddress: null,
        miscNationalId: null,
        miscEconomicCode: null,
        miscRegistrationNo: null,
        miscBankInfo: null,
        smtpHost: null,
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: null,
        smtpPass: null,
        smtpFrom: null,
        updatedAt: issueDate,
      },
    );

    const pdfText = pdf.toString('latin1');
    const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) ?? []).length;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });
});

describe('نام فایل PDF خروجی', () => {
  it('نام فایل را با نام مشتری و تاریخ شمسی پیش‌فاکتور می‌سازد', () => {
    const issueDate = jalaliToDate(1405, 8, 28);
    expect(
      buildInvoicePdfFileName({
        customerName: 'شرکت فولاد آگرین',
        issueDate,
        documentNumber: 'AG-1405-0001',
        paperSize: 'A4',
      }),
    ).toBe('شرکت فولاد آگرین - ۱۴۰۵-۰۸-۲۸.pdf');
  });

  it('کاراکترهای غیرمجاز نام فایل را پاک‌سازی و اندازه A5 را لحاظ می‌کند', () => {
    const issueDate = jalaliToDate(1405, 9, 2);
    expect(
      buildInvoicePdfFileName({
        customerName: 'آقای رضایی / پروژه: شمال',
        issueDate,
        paperSize: 'A5',
      }),
    ).toBe('آقای رضایی پروژه شمال - ۱۴۰۵-۰۹-۰۲ - A5.pdf');
  });

  it('نام فایل UTF-8 را از هدر Content-Disposition استخراج می‌کند', () => {
    const encoded = encodeURIComponent('شرکت نمونه - ۱۴۰۵-۰۹-۰۲.pdf');
    expect(
      parseContentDispositionFileName(
        `attachment; filename="invoice-AG-1405-0001-A4.pdf"; filename*=UTF-8''${encoded}`,
      ),
    ).toBe('شرکت نمونه - ۱۴۰۵-۰۹-۰۲.pdf');
  });
});
