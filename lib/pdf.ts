import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import bidiFactory from 'bidi-js';
import { ArabicShaper } from 'arabic-persian-reshaper';
import type { CompanySettings, Quotation, QuotationItem } from '@prisma/client';
import { STATUS_LABEL, UNIT_LABEL } from '@/lib/labels';
import { amountInWords, formatNumber } from '@/lib/money';
import { formatPersianText, toPersianDigits } from '@/lib/format';
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

// هر مقدار دقیقاً برابر یک توکن پالت رابط کاربری است (app/globals.css → @theme)؛
// PDFKit رنگ CSS نمی‌فهمد، پس همان کدهای hex تکرار می‌شوند.
const NAVY = '#0f1a24'; // ink-900 — سربرگ، جدول، عنوان
const BODY = '#16232f'; // ink-800 — متن بدنه جدول و شرایط
const ACCENT = '#a85d2c'; // accent-600 — کاشی لوگوی جایگزین
const GRAY = '#dfe5ea'; // line — کادرها و خطوط
const TABLE_GRID = '#b9c4cc'; // steel-300 — خطوط جدول برای وضوح در چاپ
const MUTED = '#5f6d78'; // steel-500 — متن کم‌اهمیت
const SURFACE = '#f4f6f7'; // surface — پس‌زمینه جعبه‌ها
const RULE = '#35454f'; // steel-700 — جداکننده ستون‌های هدر جدول

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
          { key: 'name', label: 'نام کالا', width: 88, align: 'right' },
          { key: 'specs', label: 'مشخصات', width: 74, align: 'right' },
          { key: 'size', label: 'سایز', width: 32, align: 'center' },
          { key: 'unit', label: 'واحد', width: 26, align: 'center' },
          { key: 'qty', label: 'مقدار', width: 33, align: 'left' },
          { key: 'price', label: 'قیمت واحد', width: 49, align: 'left' },
          { key: 'total', label: 'مبلغ کل', width: 53, align: 'left' },
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
  ) => doc.text(fa(formatPersianText(value)), x, y, { ...opts, features: ['rtla'] });

  const footerReserve = isA5 ? 28 : 36;

  const ensureSpace = (currentY: number, needed: number): number => {
    if (currentY + needed > PAGE_H - MARGIN - footerReserve) {
      drawPageFooter();
      doc.addPage();
      doc.y = MARGIN;
      return MARGIN;
    }
    return currentY;
  };

  const rtlLineHeight = (fontSize: number) => fontSize * 1.48;

  const prepareWrappedLine = (line: string, paragraphIsRtl: boolean): string => {
    if (!paragraphIsRtl) return line;
    // اگر خط بسته‌بندی‌شده با نویسه غیرفارسی (لاتین یا عدد) آغاز شود، PDFKit جهت آن خط را
    // LTR تشخیص می‌دهد؛ نشانهٔ عربی ALM (\u061C) جهت RTL و شکل‌دهی حروف را حفظ می‌کند.
    if (!/^[\u0600-\u06FF]/.test(line)) {
      return `\u061C${line}`;
    }
    return line;
  };

  const wrapRtlLines = (raw: string, maxWidth: number): string[] => {
    const logicalLines = formatPersianText(raw).split(/\r?\n/);
    const result: string[] = [];
    for (const logical of logicalLines) {
      const trimmed = logical.trim();
      if (!trimmed) {
        result.push('');
        continue;
      }
      const isRtl = /[\u0600-\u06FF]/.test(trimmed);
      const words = trimmed.split(/\s+/);
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        const measured = fa(prepareWrappedLine(candidate, isRtl));
        if (current && doc.widthOfString(measured, { features: ['rtla'] }) > maxWidth) {
          result.push(prepareWrappedLine(current, isRtl));
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) {
        result.push(prepareWrappedLine(current, isRtl));
      }
    }
    return result;
  };

  const drawRtlLines = (
    lines: string[],
    x: number,
    startY: number,
    width: number,
    align: 'right' | 'center' | 'left',
    lineHeight: number,
  ) => {
    let curY = startY;
    for (const line of lines) {
      if (line) {
        text(line, x, curY, { width, align, lineBreak: false });
      }
      curY += lineHeight;
    }
  };

  const drawPageFooter = () => {
    const y = PAGE_H - MARGIN - (isA5 ? 12 : 16);
    doc
      .moveTo(MARGIN, y - 5)
      .lineTo(PAGE_W - MARGIN, y - 5)
      .lineWidth(0.5)
      .strokeColor(GRAY)
      .stroke();
    doc.font('fa').fontSize(isA5 ? 7 : 8.2).fillColor(MUTED);
    const footerParts = [
      letterhead.companyName,
      letterhead.phone ? `تلفن: ${letterhead.phone}` : null,
      letterhead.website || null,
      `واحد پول: ${currency}`,
    ].filter(Boolean);
    text(footerParts.join(' — '), MARGIN, y, {
      width: CONTENT_W,
      align: 'right',
      height: isA5 ? 12 : 15,
      ellipsis: true,
      lineBreak: false,
    });
  };

  // ------------------------------------------------------------------ header
  const headerTop = MARGIN;
  const headerH = isA5 ? 72 : 98;
  doc
    .roundedRect(MARGIN, headerTop, CONTENT_W, headerH, 6)
    .lineWidth(1.2)
    .strokeColor(NAVY)
    .stroke();

  const logoBoxW = isA5 ? 42 : 64;
  const logoBoxH = isA5 ? 38 : 58;
  const logoPad = isA5 ? 8 : 14;
  const logoX = PAGE_W - MARGIN - logoPad - logoBoxW;

  if (letterhead.logoDataUrl?.startsWith('data:image/')) {
    try {
      const base64 = letterhead.logoDataUrl.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      doc.image(buffer, logoX, headerTop + (isA5 ? 16 : 18), {
        fit: [logoBoxW, logoBoxH],
        align: 'center',
      });
    } catch {
      doc.roundedRect(logoX, headerTop + (isA5 ? 17 : 20), logoBoxW, logoBoxH - 4, 8).fillColor(ACCENT).fill();
    }
  } else {
    doc.roundedRect(logoX, headerTop + (isA5 ? 17 : 20), logoBoxW, logoBoxH - 4, 8).fillColor(ACCENT).fill();
    doc
      .font('faBold')
      .fontSize(isA5 ? 14 : 20)
      .fillColor('#FFFFFF')
      .text('آا', logoX, headerTop + (isA5 ? 26 : 35), {
        width: logoBoxW,
        align: 'center',
        features: ['rtla'],
      });
  }

  // عنوان و شماره پیش‌فاکتور (سمت چپ سربرگ)
  const metaX = MARGIN + (isA5 ? 8 : 12);
  const metaW = isA5 ? 118 : 164;
  const metaH = headerH - (isA5 ? 12 : 18);
  doc
    .roundedRect(metaX - (isA5 ? 4 : 6), headerTop + (isA5 ? 6 : 9), metaW, metaH, 5)
    .fillColor(SURFACE)
    .fill();
  doc.font('faBold').fontSize(isA5 ? 8.5 : 10.5).fillColor(NAVY);
  text('پیش‌فاکتور فروش کالا', metaX, headerTop + (isA5 ? 10 : 15), {
    width: metaW - (isA5 ? 8 : 12),
    align: 'center',
    height: isA5 ? 12 : 16,
    ellipsis: true,
    lineBreak: false,
  });
  doc.font('fa').fontSize(isA5 ? 7.1 : 8.8).fillColor(MUTED);
  text(`شماره: ${toPersianDigits(quotation.number)}`, metaX, headerTop + (isA5 ? 24 : 35), {
    width: metaW - (isA5 ? 8 : 12),
    align: 'right',
    height: isA5 ? 11 : 15,
    ellipsis: true,
    lineBreak: false,
  });
  text(`تاریخ صدور: ${formatJalali(quotation.issueDate)}`, metaX, headerTop + (isA5 ? 36 : 51), {
    width: metaW - (isA5 ? 8 : 12),
    align: 'right',
    height: isA5 ? 11 : 15,
    ellipsis: true,
    lineBreak: false,
  });
  text(
    `اعتبار تا: ${formatJalali(addDays(quotation.issueDate, quotation.validDays))} (${formatNumber(quotation.validDays, 0)} روز)`,
    metaX,
    headerTop + (isA5 ? 48 : 67),
    {
      width: metaW - (isA5 ? 8 : 12),
      align: 'right',
      height: isA5 ? 11 : 15,
      ellipsis: true,
      lineBreak: false,
    },
  );

  const headerTextLeft = metaX + metaW + (isA5 ? 5 : 8);
  const headerTextRight = logoX - (isA5 ? 7 : 12);
  const headerTextW = Math.max(80, headerTextRight - headerTextLeft);

  doc.font('faBold').fontSize(isA5 ? 12 : 16.5).fillColor(NAVY);
  text(letterhead.companyName, headerTextLeft, headerTop + (isA5 ? 9 : 12), {
    width: headerTextW,
    align: 'right',
    height: isA5 ? 16 : 23,
    ellipsis: true,
    lineBreak: false,
  });

  const headerLines = [
    letterhead.subtitle,
    [letterhead.phone ? `تلفن: ${letterhead.phone}` : null, letterhead.website]
      .filter(Boolean)
      .join('  |  '),
    [
      letterhead.nationalId ? `شناسه ملی: ${letterhead.nationalId}` : null,
      letterhead.economicCode ? `کد اقتصادی: ${letterhead.economicCode}` : null,
    ]
      .filter(Boolean)
      .join('  |  '),
  ].filter((line): line is string => Boolean(line && line.trim()));

  if (headerLines.length === 0) {
    headerLines.push('اطلاعات سربرگ در بخش تنظیمات قابل ویرایش است.');
  }

  const headerLineStep = isA5 ? 12 : 16;
  const headerLinesStartY = headerTop + (isA5 ? 27 : 39);
  doc.font('fa').fontSize(isA5 ? 7.1 : 9.2).fillColor(MUTED);
  headerLines.slice(0, 3).forEach((line, idx) => {
    text(line, headerTextLeft, headerLinesStartY + idx * headerLineStep, {
      width: headerTextW,
      align: 'right',
      height: headerLineStep,
      ellipsis: true,
      lineBreak: false,
    });
  });

  // ------------------------------------------------------------- buyer/seller
  let y = headerTop + headerH + (isA5 ? 7 : 12);
  const boxGap = isA5 ? 7 : 12;
  const boxW = (CONTENT_W - boxGap) / 2;
  const rowStep = isA5 ? 11.5 : 16;
  const infoFontSize = isA5 ? 7.1 : 8.8;

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

  const prepareInfoBoxLayout = (rows: [string, string][]) => {
    doc.font('fa').fontSize(infoFontSize);
    const maxLabelW = rows.reduce((max, [label]) => {
      const w = doc.widthOfString(fa(`${label}:`));
      return Math.max(max, w);
    }, 0);
    const labelW = Math.min(Math.max(isA5 ? 34 : 40, Math.ceil(maxLabelW) + 4), boxW * 0.4);
    const valueW = boxW - labelW - 18;
    const preparedRows = rows.map(([label, value], idx) => {
      const normalizedValue = formatPersianText(value) || '—';
      const isLastAddress = idx === rows.length - 1;
      const lines = isLastAddress
        ? wrapRtlLines(normalizedValue, valueW)
        : [prepareWrappedLine(normalizedValue, /[\u0600-\u06FF]/.test(normalizedValue))];
      return { label, lines, isMultiline: isLastAddress && lines.length > 1 };
    });
    const visualLines = preparedRows.reduce((sum, r) => sum + r.lines.length, 0);
    return { labelW, valueW, preparedRows, visualLines };
  };

  const sellerLayout = prepareInfoBoxLayout(sellerRows);
  const buyerLayout = prepareInfoBoxLayout(buyerRows);
  const maxVisualRows = Math.max(sellerLayout.visualLines, buyerLayout.visualLines);
  const boxH = Math.max(isA5 ? 74 : 108, (isA5 ? 23 : 34) + maxVisualRows * rowStep + 4);

  const drawInfoBox = (
    x: number,
    title: string,
    layout: ReturnType<typeof prepareInfoBoxLayout>,
  ) => {
    doc.roundedRect(x, y, boxW, boxH, 5).lineWidth(0.8).strokeColor(GRAY).stroke();
    doc.roundedRect(x, y, boxW, isA5 ? 16 : 23, 5).fillColor(SURFACE).fill();
    doc.font('faBold').fontSize(isA5 ? 7.8 : 9.5).fillColor(NAVY);
    text(title, x + 7, y + (isA5 ? 4.5 : 6.5), { width: boxW - 14, align: 'right' });
    doc.font('fa').fontSize(infoFontSize);
    const labelX = x + boxW - 7 - layout.labelW;
    const valueX = x + 6;
    let rowY = y + (isA5 ? 20 : 29);
    for (const row of layout.preparedRows) {
      doc.fillColor(MUTED);
      text(`${row.label}:`, labelX, rowY, {
        width: layout.labelW,
        align: 'right',
        height: rowStep,
        ellipsis: true,
        lineBreak: false,
      });
      doc.fillColor(NAVY);
      if (row.isMultiline) {
        drawRtlLines(row.lines, valueX, rowY, layout.valueW, 'right', rowStep);
        rowY += row.lines.length * rowStep;
      } else {
        text(row.lines[0] || '—', valueX, rowY, {
          width: layout.valueW,
          align: 'right',
          ellipsis: true,
          height: rowStep,
          lineBreak: false,
        });
        rowY += rowStep;
      }
    }
  };

  drawInfoBox(PAGE_W - MARGIN - boxW, 'مشخصات فروشنده', sellerLayout);
  drawInfoBox(MARGIN, 'مشخصات خریدار', buyerLayout);

  // -------------------------------------------------------------------- table
  y += boxH + (isA5 ? 8 : 14);
  doc.y = y;

  const drawTableHeader = (top: number) => {
    const rowH = isA5 ? 18 : 24;
    doc.rect(MARGIN, top, CONTENT_W, rowH).fillColor(NAVY).fill();
    let x = PAGE_W - MARGIN;
    for (const col of COLUMNS) {
      x -= col.width;
      doc.font('faBold').fontSize(isA5 ? 7.1 : 8.8).fillColor('#FFFFFF');
      text(col.label, x + 2, top + (isA5 ? 4.5 : 6.5), { width: col.width - 4, align: col.align });
      doc
        .moveTo(x, top)
        .lineTo(x, top + rowH)
        .lineWidth(0.4)
        .strokeColor(RULE)
        .stroke();
    }
    return top + rowH;
  };

  let tableY = drawTableHeader(y);
  const visibleRows = quotation.items;
  const tableFontSize = isA5 ? 7.2 : 8.8;
  const tableLineH = rtlLineHeight(tableFontSize);

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
    const cellLinesMap: Record<string, string[]> = {};
    let maxLines = 1;
    for (const col of COLUMNS) {
      doc.font(col.key === 'name' ? 'faMedium' : 'fa').fontSize(tableFontSize);
      const wrapped = wrapRtlLines(cellTexts[col.key] || '—', col.width - cellPad);
      cellLinesMap[col.key] = wrapped;
      if (wrapped.length > maxLines) maxLines = wrapped.length;
    }
    const contentH = maxLines * tableLineH;
    const rowH = Math.max(isA5 ? 16 : 22, contentH + (isA5 ? 4 : 6));

    if (tableY + rowH > PAGE_H - MARGIN - (isA5 ? 80 : 130)) {
      drawPageFooter();
      doc.addPage();
      doc.y = MARGIN;
      tableY = drawTableHeader(MARGIN);
    }

    doc.rect(MARGIN, tableY, CONTENT_W, rowH).fillColor('#FFFFFF').fill();
    doc.rect(MARGIN, tableY, CONTENT_W, rowH).lineWidth(0.6).strokeColor(TABLE_GRID).stroke();

    let x = PAGE_W - MARGIN;
    for (const col of COLUMNS) {
      x -= col.width;
      doc
        .font(col.key === 'name' ? 'faMedium' : 'fa')
        .fontSize(tableFontSize)
        .fillColor(col.key === 'total' ? NAVY : BODY);
      drawRtlLines(
        cellLinesMap[col.key],
        x + cellPad / 2,
        tableY + (isA5 ? 2.5 : 3.5),
        col.width - cellPad,
        col.align,
        tableLineH,
      );
      doc
        .moveTo(x, tableY)
        .lineTo(x, tableY + rowH)
        .lineWidth(0.6)
        .strokeColor(TABLE_GRID)
        .stroke();
    }
    tableY += rowH;
    doc.y = tableY;
  }

  y = tableY + (isA5 ? 7 : 14);
  y = ensureSpace(y, isA5 ? 105 : 165);

  // --------------------------------------------------------------- totals box
  const totalsW = isA5 ? 182 : 248;
  const totalsX = MARGIN;
  const termsGap = isA5 ? 7 : 12;
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

  const termsFontSize = isA5 ? 7.1 : 8.8;
  const termsLineH = rtlLineHeight(termsFontSize);
  doc.font('fa').fontSize(termsFontSize);
  const termsLines = termsText.flatMap((line) => wrapRtlLines(line, termsW - 14));
  const termsContentH = termsLines.length * termsLineH;

  const totalsRowStep = isA5 ? 11.5 : 16;
  const baseTotalsH = (isA5 ? 22 : 34) + totalsRows.length * totalsRowStep + (isA5 ? 19 : 28);
  const totalsBoxH = Math.max(baseTotalsH, termsContentH + (isA5 ? 24 : 34));

  doc.roundedRect(totalsX, y, totalsW, totalsBoxH, 5).lineWidth(1).strokeColor(NAVY).stroke();
  doc.roundedRect(totalsX, y, totalsW, isA5 ? 17 : 24, 5).fillColor(NAVY).fill();
  doc.font('faBold').fontSize(isA5 ? 7.8 : 9.5).fillColor('#FFFFFF');
  text('خلاصه مالی', totalsX + 6, y + (isA5 ? 4.5 : 7), { width: totalsW - 12, align: 'right' });

  let ty = y + (isA5 ? 22 : 33);
  const valueColW = isA5 ? 82 : 102;
  for (const [label, value] of totalsRows) {
    doc.font('fa').fontSize(isA5 ? 7.2 : 8.8).fillColor(MUTED);
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
  ty += isA5 ? 4 : 7;
  doc.font('faBold').fontSize(isA5 ? 8.3 : 10.5).fillColor(NAVY);
  const grandValW = isA5 ? 92 : 114;
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
  doc.font('faBold').fontSize(isA5 ? 7.8 : 9.5).fillColor(NAVY);
  text('شرایط پرداخت، تحویل و توضیحات', totalsX + totalsW + termsGap + 7, y + (isA5 ? 4.5 : 7), {
    width: termsW - 14,
    align: 'right',
  });
  doc.font('fa').fontSize(termsFontSize).fillColor(BODY);
  drawRtlLines(
    termsLines,
    totalsX + totalsW + termsGap + 7,
    y + (isA5 ? 18 : 25),
    termsW - 14,
    'right',
    termsLineH,
  );

  y += totalsBoxH + (isA5 ? 6 : 10);

  // مبلغ به حروف
  const wordsFontSize = isA5 ? 7.5 : 9.5;
  const wordsLineH = rtlLineHeight(wordsFontSize);
  doc.font('faMedium').fontSize(wordsFontSize);
  const wordsLines = wrapRtlLines(
    `مبلغ نهایی به حروف: ${amountInWords(quotation.grandTotal, quotation.currency)}`,
    CONTENT_W - 16,
  );
  const wordsH = Math.max(isA5 ? 20 : 28, wordsLines.length * wordsLineH + (isA5 ? 8 : 12));
  y = ensureSpace(y, wordsH + (isA5 ? 6 : 10));
  doc.roundedRect(MARGIN, y, CONTENT_W, wordsH, 4).fillColor(SURFACE).fill();
  doc.font('faMedium').fontSize(wordsFontSize).fillColor(NAVY);
  drawRtlLines(wordsLines, MARGIN + 8, y + (isA5 ? 5 : 7.5), CONTENT_W - 16, 'right', wordsLineH);
  y += wordsH + (isA5 ? 6 : 10);

  if (company.disclaimerText) {
    const disclaimerFont = isA5 ? 6.8 : 8.2;
    const disclaimerLineH = rtlLineHeight(disclaimerFont);
    doc.font('fa').fontSize(disclaimerFont);
    const disclaimerLines = wrapRtlLines(company.disclaimerText, CONTENT_W - 16);
    const disclaimerH = disclaimerLines.length * disclaimerLineH;
    const disclaimerBoxH = disclaimerH + (isA5 ? 8 : 14);
    y = ensureSpace(y, disclaimerBoxH + (isA5 ? 6 : 10));
    doc
      .roundedRect(MARGIN, y, CONTENT_W, disclaimerBoxH, 4)
      .lineWidth(0.6)
      .strokeColor(GRAY)
      .stroke();
    doc.font('fa').fontSize(disclaimerFont).fillColor(MUTED);
    drawRtlLines(
      disclaimerLines,
      MARGIN + 8,
      y + (isA5 ? 4.5 : 7.5),
      CONTENT_W - 16,
      'right',
      disclaimerLineH,
    );
    y += disclaimerBoxH + (isA5 ? 6 : 10);
  }

  // امضا و مهر
  const signH = isA5 ? 44 : 78;
  y = ensureSpace(y, signH + (isA5 ? 10 : 20));
  const signGap = isA5 ? 10 : 14;
  const signW = (CONTENT_W - signGap) / 2;

  const drawSignBox = (x: number, title: string, hint: string) => {
    doc.roundedRect(x, y, signW, signH, 5).lineWidth(0.8).strokeColor(GRAY).stroke();
    doc.font('faBold').fontSize(isA5 ? 7.6 : 9.5).fillColor(NAVY);
    text(title, x + 6, y + (isA5 ? 6 : 11), { width: signW - 12, align: 'center' });
    doc.font('fa').fontSize(isA5 ? 6.8 : 8.2).fillColor(MUTED);
    text(hint, x + 6, y + signH - (isA5 ? 14 : 20), { width: signW - 12, align: 'center' });
  };

  drawSignBox(PAGE_W - MARGIN - signW, 'مهر و امضای فروشنده', 'صادرکننده سند');
  drawSignBox(MARGIN, 'مهر و امضای خریدار', 'تأیید مبالغ و شرایط فوق');

  if (quotation.status !== 'DRAFT') {
    doc
      .font('fa')
      .fontSize(isA5 ? 6.8 : 8.2)
      .fillColor(MUTED)
      .text(
        fa(`وضعیت سند: ${STATUS_LABEL[quotation.status]}`),
        MARGIN,
        PAGE_H - MARGIN - (isA5 ? 27 : 34),
        { width: CONTENT_W, align: 'left', features: ['rtla'] },
      );
  }

  drawPageFooter();
  doc.end();

  return finished;
}
