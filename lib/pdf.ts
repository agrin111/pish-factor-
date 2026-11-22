import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import bidiFactory from 'bidi-js';
import { ArabicShaper } from 'arabic-persian-reshaper';
import type { CompanySettings, Quotation, QuotationItem } from '@prisma/client';
import { STATUS_LABEL, UNIT_LABEL } from '@/lib/labels';
import { amountInWords, formatNumber } from '@/lib/money';
import { toPersianDigits } from '@/lib/format';
import { formatJalali, addDays } from '@/lib/jalali';
import { resolveLetterhead } from '@/lib/settings';

const bidi = bidiFactory();

/**
 * آماده‌سازی متن فارسی برای PDFKit:
 * PDFKit ترتیب کلمات را برای متن راست‌به‌چپ اصلاح می‌کند اما نشانه‌های
 * لاتین/عددی (مثل AG-1001 و ۱٬۲۵۰٬۰۰۰) را برعکس می‌کند؛ بنابراین آن‌ها را
 * از قبل برعکس می‌کنیم و پرانتزها را آینه می‌کنیم.
 */
const LTR_TOKEN =
  /[A-Za-z0-9\u06F0-\u06F9\u0660-\u0669][A-Za-z0-9\u06F0-\u06F9\u0660-\u0669\u066B\u066C,.:/\-_%+\u2013]*/g;

const MIRROR: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
};

export function fa(text: string | null | undefined): string {
  if (!text) return '';
  // متنی که هیچ حرف فارسی/عربی ندارد (مثل شماره موبایل یا کد لاتین) بدون تغییر می‌ماند؛
  // چون PDFKit چنین متنی را راست‌به‌چپ بازآرایی نمی‌کند.
  if (!/[\u0600-\u06FF]/.test(text)) return text;
  const mirrored = [...text].map((c) => MIRROR[c] ?? c).join('');
  return mirrored.replace(LTR_TOKEN, (token) => [...token].reverse().join(''));
}

/** شاخص‌های کتابخانه‌ی bidi برای اطمینان از پشتیبانی */
void bidi;
void ArabicShaper;

const NAVY = '#172535';
const GREEN = '#347C65';
const GRAY = '#D7DEE5';
const MUTED = '#5B6B7B';

export type PaperSize = 'A4' | 'A5';

function fontPath(file: string): string {
  const candidates = [
    path.join(process.cwd(), 'assets', 'fonts', file),
    path.join(process.cwd(), 'node_modules', 'vazirmatn', 'fonts', 'ttf', file),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`قلم فارسی یافت نشد: ${file}`);
}

export interface PdfQuotation extends Quotation {
  items: QuotationItem[];
}

export async function renderQuotationPdf(
  quotation: PdfQuotation,
  company: CompanySettings,
  options?: { paperSize?: PaperSize },
): Promise<Buffer> {
  const paperSize: PaperSize = options?.paperSize === 'A5' ? 'A5' : 'A4';
  const isA5 = paperSize === 'A5';

  const PAGE_W = isA5 ? 419.53 : 595.28;
  const PAGE_H = isA5 ? 595.28 : 841.89;
  const MARGIN = isA5 ? 22 : 36;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const COLUMNS: { key: string; label: string; width: number; align: 'right' | 'center' | 'left' }[] =
    isA5
      ? [
          { key: 'row', label: 'ردیف', width: 20, align: 'center' },
          { key: 'name', label: 'نام کالا', width: 94, align: 'right' },
          { key: 'specs', label: 'مشخصات', width: 66, align: 'right' },
          { key: 'size', label: 'سایز', width: 34, align: 'center' },
          { key: 'unit', label: 'واحد', width: 28, align: 'center' },
          { key: 'qty', label: 'مقدار', width: 33, align: 'left' },
          { key: 'price', label: 'قیمت واحد', width: 48, align: 'left' },
          { key: 'total', label: 'مبلغ کل', width: 52, align: 'left' },
        ]
      : [
          { key: 'row', label: 'ردیف', width: 26, align: 'center' },
          { key: 'name', label: 'نام کالا', width: 132, align: 'right' },
          { key: 'specs', label: 'مشخصات', width: 102, align: 'right' },
          { key: 'size', label: 'سایز', width: 46, align: 'center' },
          { key: 'unit', label: 'واحد', width: 36, align: 'center' },
          { key: 'qty', label: 'مقدار', width: 44, align: 'left' },
          { key: 'price', label: 'قیمت واحد', width: 66, align: 'left' },
          { key: 'total', label: 'مبلغ کل', width: 71, align: 'left' },
        ];

  const letterhead = resolveLetterhead(company, quotation.letterheadType ?? 'MAIN');

  const doc = new PDFDocument({
    size: paperSize,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `پیش‌فاکتور ${toPersianDigits(quotation.number)}`,
      Author: letterhead.companyName,
      Subject: 'پیش‌فاکتور فروش کالا',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
  });

  doc.registerFont('fa', fontPath('Vazirmatn-Regular.ttf'));
  doc.registerFont('faBold', fontPath('Vazirmatn-Bold.ttf'));
  doc.registerFont('faMedium', fontPath('Vazirmatn-Medium.ttf'));

  const currency = quotation.currency === 'RIAL' ? 'ریال' : 'تومان';

  const text = (
    value: string,
    x: number,
    y: number,
    opts: PDFKit.Mixins.TextOptions & { width: number },
  ) => doc.text(fa(value), x, y, { ...opts, features: ['rtla'] });

  const footerReserve = isA5 ? 22 : 30;

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > PAGE_H - MARGIN - footerReserve) {
      drawPageFooter();
      doc.addPage();
      doc.y = MARGIN;
    }
  };

  const drawPageFooter = () => {
    const y = PAGE_H - MARGIN - (isA5 ? 11 : 14);
    doc
      .moveTo(MARGIN, y - 5)
      .lineTo(PAGE_W - MARGIN, y - 5)
      .lineWidth(0.5)
      .strokeColor(GRAY)
      .stroke();
    doc.font('fa').fontSize(isA5 ? 6.2 : 7.5).fillColor(MUTED);
    text(
      `${letterhead.companyName} — ${letterhead.phone ?? 'تلفن ثبت نشده'} — ${letterhead.address ?? 'نشانی ثبت نشده'}`,
      MARGIN,
      y,
      { width: CONTENT_W, align: 'right', height: isA5 ? 11 : 14, ellipsis: true },
    );
  };

  // ------------------------------------------------------------------ header
  const headerTop = MARGIN;
  const headerH = isA5 ? 74 : 92;
  doc
    .roundedRect(MARGIN, headerTop, CONTENT_W, headerH, 6)
    .lineWidth(1.2)
    .strokeColor(NAVY)
    .stroke();

  const logoBoxW = isA5 ? 46 : 66;
  const logoBoxH = isA5 ? 40 : 56;
  const logoPad = isA5 ? 10 : 16;
  const logoX = PAGE_W - MARGIN - logoPad - logoBoxW;

  if (letterhead.logoDataUrl?.startsWith('data:image/')) {
    try {
      const base64 = letterhead.logoDataUrl.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      doc.image(buffer, logoX, headerTop + (isA5 ? 14 : 16), {
        fit: [logoBoxW, logoBoxH],
        align: 'center',
      });
    } catch {
      doc.roundedRect(logoX, headerTop + (isA5 ? 15 : 18), logoBoxW, logoBoxH - 4, 8).fillColor(GREEN).fill();
    }
  } else {
    doc.roundedRect(logoX, headerTop + (isA5 ? 15 : 18), logoBoxW, logoBoxH - 4, 8).fillColor(GREEN).fill();
    doc
      .font('faBold')
      .fontSize(isA5 ? 15 : 20)
      .fillColor('#FFFFFF')
      .text('آا', logoX, headerTop + (isA5 ? 25 : 33), {
        width: logoBoxW,
        align: 'center',
        features: ['rtla'],
      });
  }

  // عنوان و شماره پیش‌فاکتور (سمت چپ سربرگ)
  const metaX = MARGIN + (isA5 ? 8 : 12);
  const metaW = isA5 ? 116 : 150;
  const metaH = headerH - (isA5 ? 14 : 20);
  doc
    .roundedRect(metaX - (isA5 ? 4 : 6), headerTop + (isA5 ? 7 : 10), metaW, metaH, 5)
    .fillColor('#F1F3F5')
    .fill();
  doc.font('faBold').fontSize(isA5 ? 8.2 : 10).fillColor(NAVY);
  text('پیش‌فاکتور فروش کالا', metaX, headerTop + (isA5 ? 11 : 16), {
    width: metaW - (isA5 ? 8 : 12),
    align: 'center',
  });
  doc.font('fa').fontSize(isA5 ? 6.5 : 8).fillColor(MUTED);
  text(`شماره: ${toPersianDigits(quotation.number)}`, metaX, headerTop + (isA5 ? 25 : 34), {
    width: metaW - (isA5 ? 8 : 12),
    align: 'right',
  });
  text(`تاریخ صدور: ${formatJalali(quotation.issueDate)}`, metaX, headerTop + (isA5 ? 37 : 47), {
    width: metaW - (isA5 ? 8 : 12),
    align: 'right',
  });
  text(
    `اعتبار تا: ${formatJalali(addDays(quotation.issueDate, quotation.validDays))} (${formatNumber(quotation.validDays, 0)} روز)`,
    metaX,
    headerTop + (isA5 ? 49 : 60),
    { width: metaW - (isA5 ? 8 : 12), align: 'right' },
  );

  const headerTextLeft = metaX + metaW + (isA5 ? 6 : 8);
  const headerTextRight = logoX - (isA5 ? 10 : 14);
  const headerTextW = Math.max(80, headerTextRight - headerTextLeft);

  doc.font('faBold').fontSize(isA5 ? 12.5 : 17).fillColor(NAVY);
  text(letterhead.companyName, headerTextLeft, headerTop + (isA5 ? 12 : 16), {
    width: headerTextW,
    align: 'right',
  });
  doc.font('fa').fontSize(isA5 ? 6.8 : 8.5).fillColor(MUTED);
  text(
    [letterhead.subtitle, letterhead.phone ? `تلفن: ${letterhead.phone}` : null, letterhead.website]
      .filter(Boolean)
      .join('  |  ') || 'اطلاعات سربرگ در بخش تنظیمات قابل ویرایش است.',
    headerTextLeft,
    headerTop + (isA5 ? 31 : 40),
    { width: headerTextW, align: 'right' },
  );
  text(
    [
      letterhead.nationalId ? `شناسه ملی: ${letterhead.nationalId}` : null,
      letterhead.economicCode ? `کد اقتصادی: ${letterhead.economicCode}` : null,
    ]
      .filter(Boolean)
      .join('  |  '),
    headerTextLeft,
    headerTop + (isA5 ? 47 : 58),
    { width: headerTextW, align: 'right' },
  );

  // ------------------------------------------------------------- buyer/seller
  let y = headerTop + headerH + (isA5 ? 8 : 12);
  const boxGap = isA5 ? 8 : 12;
  const boxW = (CONTENT_W - boxGap) / 2;
  const rowStep = isA5 ? 11.5 : 13;

  const sellerRows: [string, string][] = [
    ['نام شرکت', letterhead.companyName],
    [
      'شناسه / ثبت',
      [
        letterhead.nationalId,
        letterhead.registrationNo ? `ثبت ${letterhead.registrationNo}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    ],
    ['تلفن', [letterhead.phone, letterhead.secondaryPhone].filter(Boolean).join(' · ')],
    ['نشانی', letterhead.address ?? ''],
  ];

  const buyerRows: [string, string][] = [
    ['نام مشتری', quotation.customerName],
    ['شرکت / پروژه', quotation.customerCompany ?? ''],
    ['تلفن / موبایل', [quotation.customerMobile, quotation.customerPhone].filter(Boolean).join(' · ')],
    ...(quotation.customerNationalId || quotation.customerEconomicCode
      ? ([
          [
            'شناسه / اقتصادی',
            [quotation.customerNationalId, quotation.customerEconomicCode]
              .filter(Boolean)
              .join(' · '),
          ],
        ] as [string, string][])
      : []),
    ['نشانی', [quotation.customerCity, quotation.customerAddress].filter(Boolean).join(' — ')],
  ];

  const maxInfoRows = Math.max(sellerRows.length, buyerRows.length);
  const boxH = Math.max(isA5 ? 74 : 92, (isA5 ? 24 : 30) + maxInfoRows * rowStep + 4);

  const drawInfoBox = (x: number, title: string, rows: [string, string][]) => {
    doc.roundedRect(x, y, boxW, boxH, 5).lineWidth(0.8).strokeColor(GRAY).stroke();
    doc.roundedRect(x, y, boxW, isA5 ? 16 : 20, 5).fillColor('#F1F3F5').fill();
    doc.font('faBold').fontSize(isA5 ? 7.2 : 8.5).fillColor(NAVY);
    text(title, x + 6, y + (isA5 ? 4.5 : 6), { width: boxW - 12, align: 'right' });
    doc.font('fa').fontSize(isA5 ? 6.6 : 8);
    let rowY = y + (isA5 ? 21 : 26);
    const labelW = isA5 ? 46 : 58;
    for (const [label, value] of rows) {
      doc.fillColor(MUTED);
      text(`${label}:`, x + 6, rowY, { width: labelW, align: 'right' });
      doc.fillColor(NAVY);
      text(value || '—', x + labelW + 6, rowY, {
        width: boxW - labelW - 14,
        align: 'right',
        ellipsis: true,
        height: rowStep,
      });
      rowY += rowStep;
    }
  };

  drawInfoBox(PAGE_W - MARGIN - boxW, 'مشخصات فروشنده', sellerRows);
  drawInfoBox(MARGIN, 'مشخصات خریدار', buyerRows);

  // -------------------------------------------------------------------- table
  y += boxH + (isA5 ? 9 : 14);
  doc.y = y;

  const drawTableHeader = (top: number) => {
    const rowH = isA5 ? 17 : 20;
    doc.rect(MARGIN, top, CONTENT_W, rowH).fillColor(NAVY).fill();
    let x = PAGE_W - MARGIN;
    for (const col of COLUMNS) {
      x -= col.width;
      doc.font('faBold').fontSize(isA5 ? 6.3 : 7.5).fillColor('#FFFFFF');
      text(col.label, x + 2, top + (isA5 ? 5 : 6), { width: col.width - 4, align: col.align });
      doc
        .moveTo(x, top)
        .lineTo(x, top + rowH)
        .lineWidth(0.4)
        .strokeColor('#3C4E62')
        .stroke();
    }
    return top + rowH;
  };

  let tableY = drawTableHeader(y);
  const visibleRows = quotation.items;
  const tableFontSize = isA5 ? 6.4 : 7.6;

  for (const item of visibleRows) {
    const cellTexts: Record<string, string> = {
      row: formatNumber(item.rowIndex, 0),
      name: item.productName,
      specs: item.specs ?? '',
      size: item.size ?? '',
      unit: UNIT_LABEL[item.unit] ?? '',
      qty: formatNumber(item.quantity, 3),
      price: formatNumber(item.unitPrice, 0),
      total: formatNumber(item.lineTotal, 0),
    };

    const cellPad = isA5 ? 4 : 6;
    const contentH = Math.max(
      ...COLUMNS.map((col) =>
        doc
          .font(col.key === 'name' ? 'faMedium' : 'fa')
          .fontSize(tableFontSize)
          .heightOfString(fa(cellTexts[col.key]) || '—', {
            width: col.width - cellPad,
            features: ['rtla'],
          }),
      ),
    );
    const rowH = Math.max(isA5 ? 15 : 18, contentH + (isA5 ? 5 : 7));

    if (tableY + rowH > PAGE_H - MARGIN - (isA5 ? 90 : 120)) {
      drawPageFooter();
      doc.addPage();
      doc.y = MARGIN;
      tableY = drawTableHeader(MARGIN);
    }

    doc.rect(MARGIN, tableY, CONTENT_W, rowH).fillColor('#FFFFFF').fill();
    doc.rect(MARGIN, tableY, CONTENT_W, rowH).lineWidth(0.4).strokeColor(GRAY).stroke();

    let x = PAGE_W - MARGIN;
    for (const col of COLUMNS) {
      x -= col.width;
      doc
        .font(col.key === 'name' ? 'faMedium' : 'fa')
        .fontSize(tableFontSize)
        .fillColor(col.key === 'total' ? NAVY : '#25313D');
      text(cellTexts[col.key] || '—', x + cellPad / 2, tableY + (isA5 ? 3 : 4), {
        width: col.width - cellPad,
        align: col.align,
      });
      doc
        .moveTo(x, tableY)
        .lineTo(x, tableY + rowH)
        .lineWidth(0.4)
        .strokeColor(GRAY)
        .stroke();
    }
    tableY += rowH;
    doc.y = tableY;
  }

  y = tableY + (isA5 ? 8 : 12);
  ensureSpace(isA5 ? 110 : 150);
  if (doc.y > y) y = doc.y;

  // --------------------------------------------------------------- totals box
  const totalsW = isA5 ? 174 : 236;
  const totalsX = MARGIN;
  const termsGap = isA5 ? 8 : 12;
  const termsW = CONTENT_W - totalsW - termsGap;

  const totalWeightNum = Number(quotation.totalWeightKg ?? 0);
  const totalsRows: [string, string][] = [
    ['جمع کل کالاها', `${formatNumber(quotation.itemsSubtotal, 0)} ${currency}`],
    ['هزینه حمل', `${formatNumber(quotation.transportCost, 0)} ${currency}`],
    ['تخفیف', `${formatNumber(quotation.discountAmount, 0)} ${currency}`],
    [
      quotation.includeVat ? `مالیات (${formatNumber(quotation.vatRate, 0)}٪)` : 'مالیات',
      quotation.includeVat ? `${formatNumber(quotation.vatAmount, 0)} ${currency}` : 'معاف',
    ],
    ...(totalWeightNum > 0
      ? ([['وزن کل محموله', `${formatNumber(totalWeightNum, 2)} کیلوگرم`]] as [string, string][])
      : []),
  ];

  const termsText = [
    `شرایط پرداخت: ${quotation.paymentTerms || '—'}`,
    `شرایط تحویل: ${quotation.deliveryTerms || '—'}`,
    letterhead.bankInfo ? `اطلاعات بانکی: ${letterhead.bankInfo}` : null,
    quotation.notes ? `توضیحات: ${quotation.notes}` : null,
  ].filter(Boolean) as string[];

  const termsFontSize = isA5 ? 6.5 : 7.6;
  const termsContentH = doc
    .font('fa')
    .fontSize(termsFontSize)
    .heightOfString(fa(termsText.join('\n')), { width: termsW - 14, features: ['rtla'] });

  const totalsRowStep = isA5 ? 12 : 14;
  const baseTotalsH = (isA5 ? 24 : 30) + totalsRows.length * totalsRowStep + (isA5 ? 20 : 24);
  const totalsBoxH = Math.max(baseTotalsH, termsContentH + (isA5 ? 24 : 28));

  doc.roundedRect(totalsX, y, totalsW, totalsBoxH, 5).lineWidth(1).strokeColor(NAVY).stroke();
  doc.roundedRect(totalsX, y, totalsW, isA5 ? 18 : 22, 5).fillColor(NAVY).fill();
  doc.font('faBold').fontSize(isA5 ? 7.2 : 8.5).fillColor('#FFFFFF');
  text('خلاصه مالی', totalsX + 6, y + (isA5 ? 5 : 7), { width: totalsW - 12, align: 'right' });

  let ty = y + (isA5 ? 24 : 30);
  const valueColW = isA5 ? 74 : 86;
  for (const [label, value] of totalsRows) {
    doc.font('fa').fontSize(isA5 ? 6.8 : 8).fillColor(MUTED);
    text(label, totalsX + valueColW + 10, ty, {
      width: totalsW - valueColW - 16,
      align: 'right',
    });
    doc.fillColor(NAVY);
    text(value, totalsX + 6, ty, { width: valueColW, align: 'left' });
    ty += totalsRowStep;
  }

  ty += 2;
  doc
    .moveTo(totalsX + 6, ty)
    .lineTo(totalsX + totalsW - 6, ty)
    .lineWidth(0.8)
    .strokeColor(NAVY)
    .stroke();
  ty += isA5 ? 4 : 6;
  doc.font('faBold').fontSize(isA5 ? 7.8 : 9.5).fillColor(NAVY);
  const grandValW = isA5 ? 82 : 92;
  text('مبلغ نهایی', totalsX + grandValW + 8, ty, {
    width: totalsW - grandValW - 14,
    align: 'right',
  });
  text(`${formatNumber(quotation.grandTotal, 0)} ${currency}`, totalsX + 6, ty, {
    width: grandValW,
    align: 'left',
  });

  // شرایط و توضیحات
  doc
    .roundedRect(totalsX + totalsW + termsGap, y, termsW, totalsBoxH, 5)
    .lineWidth(0.8)
    .strokeColor(GRAY)
    .stroke();
  doc.font('faBold').fontSize(isA5 ? 7.2 : 8.5).fillColor(NAVY);
  text('شرایط پرداخت، تحویل و توضیحات', totalsX + totalsW + termsGap + 7, y + (isA5 ? 5 : 7), {
    width: termsW - 14,
    align: 'right',
  });
  doc.font('fa').fontSize(termsFontSize).fillColor('#25313D');
  text(termsText.join('\n'), totalsX + totalsW + termsGap + 7, y + (isA5 ? 18 : 22), {
    width: termsW - 14,
    align: 'right',
  });

  y += totalsBoxH + (isA5 ? 6 : 8);

  // مبلغ به حروف
  const wordsH = isA5 ? 22 : 26;
  doc.roundedRect(MARGIN, y, CONTENT_W, wordsH, 4).fillColor('#F1F3F5').fill();
  doc.font('faMedium').fontSize(isA5 ? 7 : 8.5).fillColor(NAVY);
  text(
    `مبلغ نهایی به حروف: ${amountInWords(quotation.grandTotal, quotation.currency)}`,
    MARGIN + 8,
    y + (isA5 ? 6 : 8),
    {
      width: CONTENT_W - 16,
      align: 'right',
    },
  );
  y += wordsH + (isA5 ? 6 : 8);

  if (company.disclaimerText) {
    const disclaimerFont = isA5 ? 6 : 7;
    const disclaimerH = doc
      .font('fa')
      .fontSize(disclaimerFont)
      .heightOfString(fa(company.disclaimerText), { width: CONTENT_W - 16, features: ['rtla'] });
    ensureSpace(disclaimerH + (isA5 ? 20 : 30));
    if (doc.y > y) y = doc.y;
    doc
      .roundedRect(MARGIN, y, CONTENT_W, disclaimerH + (isA5 ? 12 : 16), 4)
      .lineWidth(0.6)
      .strokeColor(GRAY)
      .stroke();
    doc.font('fa').fontSize(disclaimerFont).fillColor(MUTED);
    text(company.disclaimerText, MARGIN + 8, y + (isA5 ? 6 : 8), {
      width: CONTENT_W - 16,
      align: 'right',
    });
    y += disclaimerH + (isA5 ? 18 : 24);
  }

  // امضا و مهر
  const signH = isA5 ? 52 : 72;
  ensureSpace(signH + (isA5 ? 12 : 18));
  if (doc.y > y) y = doc.y;
  const signGap = isA5 ? 10 : 14;
  const signW = (CONTENT_W - signGap) / 2;

  const drawSignBox = (x: number, title: string, hint: string) => {
    doc.roundedRect(x, y, signW, signH, 5).lineWidth(0.8).strokeColor(GRAY).stroke();
    doc.font('faBold').fontSize(isA5 ? 7.2 : 8.5).fillColor(NAVY);
    text(title, x + 6, y + (isA5 ? 7 : 10), { width: signW - 12, align: 'center' });
    doc.font('fa').fontSize(isA5 ? 6 : 7).fillColor(MUTED);
    text(hint, x + 6, y + signH - (isA5 ? 14 : 18), { width: signW - 12, align: 'center' });
  };

  drawSignBox(PAGE_W - MARGIN - signW, 'مهر و امضای فروشنده', 'صادرکننده سند');
  drawSignBox(MARGIN, 'مهر و امضای خریدار', 'تأیید مبالغ و شرایط فوق');

  if (quotation.status !== 'DRAFT') {
    doc
      .font('fa')
      .fontSize(isA5 ? 6 : 7)
      .fillColor(MUTED)
      .text(
        fa(`وضعیت سند: ${STATUS_LABEL[quotation.status]}`),
        MARGIN,
        PAGE_H - MARGIN - (isA5 ? 23 : 30),
        { width: CONTENT_W, align: 'left', features: ['rtla'] },
      );
  }

  drawPageFooter();
  doc.end();

  return finished;
}
