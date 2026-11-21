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

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLUMNS: { key: string; label: string; width: number; align: 'right' | 'center' | 'left' }[] =
  [
    { key: 'row', label: 'ردیف', width: 26, align: 'center' },
    { key: 'name', label: 'نام کالا', width: 132, align: 'right' },
    { key: 'specs', label: 'مشخصات', width: 102, align: 'right' },
    { key: 'size', label: 'سایز', width: 46, align: 'center' },
    { key: 'unit', label: 'واحد', width: 36, align: 'center' },
    { key: 'qty', label: 'مقدار', width: 44, align: 'left' },
    { key: 'price', label: 'قیمت واحد', width: 66, align: 'left' },
    { key: 'total', label: 'مبلغ کل', width: 71, align: 'left' },
  ];

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
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `پیش‌فاکتور ${toPersianDigits(quotation.number)}`,
      Author: company.companyName,
      Subject: 'پیش‌فاکتور فروش کالا',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.registerFont('fa', fontPath('Vazirmatn-Regular.ttf'));
  doc.registerFont('faBold', fontPath('Vazirmatn-Bold.ttf'));
  doc.registerFont('faMedium', fontPath('Vazirmatn-Medium.ttf'));

  const currency = quotation.currency === 'RIAL' ? 'ریال' : 'تومان';

  const text = (
    value: string,
    x: number,
    y: number,
    options: PDFKit.Mixins.TextOptions & { width: number },
  ) => doc.text(fa(value), x, y, { ...options, features: ['rtla'] });

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > PAGE_H - MARGIN - 30) {
      doc.addPage();
      drawPageFooter();
      doc.y = MARGIN;
    }
  };

  const drawPageFooter = () => {
    const y = PAGE_H - MARGIN - 14;
    doc
      .moveTo(MARGIN, y - 6)
      .lineTo(PAGE_W - MARGIN, y - 6)
      .lineWidth(0.5)
      .strokeColor(GRAY)
      .stroke();
    doc.font('fa').fontSize(7.5).fillColor(MUTED);
    text(
      `${company.companyName} — ${company.phone ?? 'تلفن ثبت نشده'} — ${company.address ?? 'نشانی ثبت نشده'}`,
      MARGIN,
      y,
      { width: CONTENT_W, align: 'right' },
    );
  };

  // ------------------------------------------------------------------ header
  const headerTop = MARGIN;
  doc
    .roundedRect(MARGIN, headerTop, CONTENT_W, 92, 6)
    .lineWidth(1.2)
    .strokeColor(NAVY)
    .stroke();

  const logoBoxW = 66;
  const logoX = PAGE_W - MARGIN - 16 - logoBoxW;

  if (company.logoDataUrl?.startsWith('data:image/')) {
    try {
      const base64 = company.logoDataUrl.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      doc.image(buffer, logoX, headerTop + 16, { fit: [logoBoxW, 56], align: 'center' });
    } catch {
      doc.roundedRect(logoX, headerTop + 18, logoBoxW, 52, 8).fillColor(GREEN).fill();
    }
  } else {
    doc.roundedRect(logoX, headerTop + 18, logoBoxW, 52, 8).fillColor(GREEN).fill();
    doc
      .font('faBold')
      .fontSize(20)
      .fillColor('#FFFFFF')
      .text('آا', logoX, headerTop + 33, { width: logoBoxW, align: 'center', features: ['rtla'] });
  }

  const headerTextRight = logoX - 14;
  doc.font('faBold').fontSize(17).fillColor(NAVY);
  text(company.companyName, MARGIN + 150, headerTop + 16, {
    width: headerTextRight - MARGIN - 150,
    align: 'right',
  });
  doc.font('fa').fontSize(8.5).fillColor(MUTED);
  text(
    [company.subtitle, company.phone ? `تلفن: ${company.phone}` : null, company.website]
      .filter(Boolean)
      .join('  |  ') || 'اطلاعات شرکت در بخش تنظیمات تکمیل نشده است.',
    MARGIN + 150,
    headerTop + 40,
    { width: headerTextRight - MARGIN - 150, align: 'right' },
  );
  text(
    [company.nationalId ? `شناسه ملی: ${company.nationalId}` : null, company.economicCode ? `کد اقتصادی: ${company.economicCode}` : null]
      .filter(Boolean)
      .join('  |  '),
    MARGIN + 150,
    headerTop + 58,
    { width: headerTextRight - MARGIN - 150, align: 'right' },
  );

  // عنوان و شماره پیش‌فاکتور (سمت چپ سربرگ)
  const metaX = MARGIN + 12;
  const metaW = 150;
  doc
    .roundedRect(metaX - 6, headerTop + 10, metaW, 72, 5)
    .fillColor('#F1F3F5')
    .fill();
  doc.font('faBold').fontSize(10).fillColor(NAVY);
  text('پیش‌فاکتور فروش کالا', metaX, headerTop + 16, { width: metaW - 12, align: 'center' });
  doc.font('fa').fontSize(8).fillColor(MUTED);
  text(`شماره: ${toPersianDigits(quotation.number)}`, metaX, headerTop + 34, {
    width: metaW - 12,
    align: 'right',
  });
  text(`تاریخ صدور: ${formatJalali(quotation.issueDate)}`, metaX, headerTop + 47, {
    width: metaW - 12,
    align: 'right',
  });
  text(
    `اعتبار تا: ${formatJalali(addDays(quotation.issueDate, quotation.validDays))} (${formatNumber(quotation.validDays, 0)} روز)`,
    metaX,
    headerTop + 60,
    { width: metaW - 12, align: 'right' },
  );

  // ------------------------------------------------------------- buyer/seller
  let y = headerTop + 104;
  const boxW = (CONTENT_W - 12) / 2;
  const boxH = 92;

  const drawInfoBox = (x: number, title: string, rows: [string, string][]) => {
    doc.roundedRect(x, y, boxW, boxH, 5).lineWidth(0.8).strokeColor(GRAY).stroke();
    doc.roundedRect(x, y, boxW, 20, 5).fillColor('#F1F3F5').fill();
    doc.font('faBold').fontSize(8.5).fillColor(NAVY);
    text(title, x + 8, y + 6, { width: boxW - 16, align: 'right' });
    doc.font('fa').fontSize(8);
    let rowY = y + 26;
    for (const [label, value] of rows) {
      doc.fillColor(MUTED);
      text(`${label}:`, x + 8, rowY, { width: 52, align: 'right' });
      doc.fillColor(NAVY);
      text(value || '—', x + 60, rowY, { width: boxW - 70, align: 'right' });
      rowY += 13;
    }
  };

  drawInfoBox(PAGE_W - MARGIN - boxW, 'مشخصات فروشنده', [
    ['نام شرکت', company.companyName],
    ['شناسه ملی', company.nationalId ?? ''],
    ['تلفن', company.phone ?? ''],
    ['نشانی', company.address ?? ''],
  ]);

  drawInfoBox(MARGIN, 'مشخصات خریدار', [
    ['نام مشتری', quotation.customerName],
    ['شرکت / پروژه', quotation.customerCompany ?? ''],
    ['موبایل', quotation.customerMobile],
    ['نشانی', quotation.customerAddress ?? ''],
  ]);

  // -------------------------------------------------------------------- table
  y += boxH + 14;
  doc.y = y;

  const drawTableHeader = (top: number) => {
    const rowH = 20;
    doc.rect(MARGIN, top, CONTENT_W, rowH).fillColor(NAVY).fill();
    let x = PAGE_W - MARGIN;
    for (const col of COLUMNS) {
      x -= col.width;
      doc.font('faBold').fontSize(7.5).fillColor('#FFFFFF');
      text(col.label, x + 2, top + 6, { width: col.width - 4, align: col.align });
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
  const visibleRows = quotation.items.slice(0, 40);

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

    const contentH = Math.max(
      ...COLUMNS.map((col) =>
        doc
          .font(col.key === 'name' ? 'faMedium' : 'fa')
          .fontSize(7.6)
          .heightOfString(fa(cellTexts[col.key]) || '—', { width: col.width - 6, features: ['rtla'] }),
      ),
    );
    const rowH = Math.max(18, contentH + 7);

    if (tableY + rowH > PAGE_H - MARGIN - 120) {
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
        .fontSize(7.6)
        .fillColor(col.key === 'total' ? NAVY : '#25313D');
      text(cellTexts[col.key] || '—', x + 3, tableY + 4, {
        width: col.width - 6,
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

  y = tableY + 12;
  ensureSpace(150);
  if (doc.y > y) y = doc.y;

  // --------------------------------------------------------------- totals box
  const totalsW = 236;
  const totalsX = MARGIN;
  const termsW = CONTENT_W - totalsW - 12;

  const totalsRows: [string, string][] = [
    ['جمع کل کالاها', `${formatNumber(quotation.itemsSubtotal, 0)} ${currency}`],
    ['هزینه حمل', `${formatNumber(quotation.transportCost, 0)} ${currency}`],
    ['تخفیف', `${formatNumber(quotation.discountAmount, 0)} ${currency}`],
    [
      quotation.includeVat ? `مالیات (${formatNumber(quotation.vatRate, 0)}٪)` : 'مالیات',
      quotation.includeVat ? `${formatNumber(quotation.vatAmount, 0)} ${currency}` : 'معاف',
    ],
  ];

  const totalsBoxH = 30 + totalsRows.length * 14 + 24;
  doc.roundedRect(totalsX, y, totalsW, totalsBoxH, 5).lineWidth(1).strokeColor(NAVY).stroke();
  doc.roundedRect(totalsX, y, totalsW, 22, 5).fillColor(NAVY).fill();
  doc.font('faBold').fontSize(8.5).fillColor('#FFFFFF');
  text('خلاصه مالی', totalsX + 8, y + 7, { width: totalsW - 16, align: 'right' });

  let ty = y + 30;
  for (const [label, value] of totalsRows) {
    doc.font('fa').fontSize(8).fillColor(MUTED);
    text(label, totalsX + 84, ty, { width: totalsW - 92, align: 'right' });
    doc.fillColor(NAVY);
    text(value, totalsX + 8, ty, { width: 74, align: 'left' });
    ty += 14;
  }

  ty += 2;
  doc
    .moveTo(totalsX + 6, ty)
    .lineTo(totalsX + totalsW - 6, ty)
    .lineWidth(0.8)
    .strokeColor(NAVY)
    .stroke();
  ty += 6;
  doc.font('faBold').fontSize(9.5).fillColor(NAVY);
  text('مبلغ نهایی', totalsX + 100, ty, { width: 100, align: 'right' });
  text(`${formatNumber(quotation.grandTotal, 0)} ${currency}`, totalsX + 6, ty, {
    width: 92,
    align: 'left',
  });

  // شرایط و توضیحات
  const termsText = [
    `شرایط پرداخت: ${quotation.paymentTerms || '—'}`,
    `شرایط تحویل: ${quotation.deliveryTerms || '—'}`,
    company.bankInfo ? `اطلاعات بانکی: ${company.bankInfo}` : null,
    quotation.notes ? `توضیحات: ${quotation.notes}` : null,
  ].filter(Boolean) as string[];

  doc.roundedRect(totalsX + totalsW + 12, y, termsW, totalsBoxH, 5).lineWidth(0.8).strokeColor(GRAY).stroke();
  doc.font('faBold').fontSize(8.5).fillColor(NAVY);
  text('شرایط پرداخت، تحویل و توضیحات', totalsX + totalsW + 20, y + 7, {
    width: termsW - 16,
    align: 'right',
  });
  doc.font('fa').fontSize(7.6).fillColor('#25313D');
  text(termsText.join('\n'), totalsX + totalsW + 20, y + 22, {
    width: termsW - 16,
    align: 'right',
  });

  y += totalsBoxH + 8;

  // مبلغ به حروف
  doc.roundedRect(MARGIN, y, CONTENT_W, 26, 4).fillColor('#F1F3F5').fill();
  doc.font('faMedium').fontSize(8.5).fillColor(NAVY);
  text(`مبلغ نهایی به حروف: ${amountInWords(quotation.grandTotal, quotation.currency)}`, MARGIN + 10, y + 8, {
    width: CONTENT_W - 20,
    align: 'right',
  });
  y += 34;

  if (company.disclaimerText) {
    const disclaimerH = doc
      .font('fa')
      .fontSize(7)
      .heightOfString(fa(company.disclaimerText), { width: CONTENT_W - 20, features: ['rtla'] });
    ensureSpace(disclaimerH + 30);
    if (doc.y > y) y = doc.y;
    doc.roundedRect(MARGIN, y, CONTENT_W, disclaimerH + 16, 4).lineWidth(0.6).strokeColor(GRAY).stroke();
    doc.font('fa').fontSize(7).fillColor(MUTED);
    text(company.disclaimerText, MARGIN + 10, y + 8, { width: CONTENT_W - 20, align: 'right' });
    y += disclaimerH + 24;
  }

  // امضا و مهر
  ensureSpace(90);
  if (doc.y > y) y = doc.y;
  const signW = (CONTENT_W - 14) / 2;
  const signH = 72;

  const drawSignBox = (x: number, title: string, hint: string) => {
    doc.roundedRect(x, y, signW, signH, 5).lineWidth(0.8).strokeColor(GRAY).stroke();
    doc.font('faBold').fontSize(8.5).fillColor(NAVY);
    text(title, x + 8, y + 10, { width: signW - 16, align: 'center' });
    doc.font('fa').fontSize(7).fillColor(MUTED);
    text(hint, x + 8, y + signH - 18, { width: signW - 16, align: 'center' });
  };

  drawSignBox(PAGE_W - MARGIN - signW, 'مهر و امضای فروشنده', `صادرکننده سند`);
  drawSignBox(MARGIN, 'مهر و امضای خریدار', 'تأیید مبالغ و شرایط فوق');

  if (quotation.status !== 'DRAFT') {
    doc
      .font('fa')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        fa(`وضعیت سند: ${STATUS_LABEL[quotation.status]}`),
        MARGIN,
        PAGE_H - MARGIN - 30,
        { width: CONTENT_W, align: 'left', features: ['rtla'] },
      );
  }

  drawPageFooter();
  doc.end();

  return finished;
}
