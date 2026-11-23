import {
  amountInWords,
  formatCurrency,
  formatDocumentNumber,
  formatNumber,
  formatPersianText,
  toPersianDigits,
} from '@/lib/format';
import { formatJalali } from '@/lib/jalali';
import { STATUS_LABEL, UNIT_LABEL } from '@/lib/labels';
import { resolveLetterhead } from '@/lib/settings';
import type { CompanySettings, LetterheadType, QuotationStatus, UnitType } from '@prisma/client';

export interface DocumentQuotation {
  id: string;
  number: string;
  status: QuotationStatus;
  issueDate: Date;
  validUntil: Date;
  validDays: number;
  customerName: string;
  customerMobile: string;
  customerPhone?: string | null;
  customerCompany: string | null;
  customerNationalId?: string | null;
  customerEconomicCode?: string | null;
  customerCity?: string | null;
  customerAddress: string | null;
  currency: 'TOMAN' | 'RIAL';
  includeVat: boolean;
  vatRate: string;
  itemsSubtotal: string;
  transportCost: string;
  discountAmount: string;
  vatAmount: string;
  grandTotal: string;
  totalWeightKg?: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
  letterheadType?: LetterheadType;
  createdByName: string;
  items: {
    id: string;
    rowIndex: number;
    sku?: string | null;
    productName: string;
    specs: string | null;
    size: string | null;
    unit: UnitType;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }[];
}

interface Props {
  quotation: DocumentQuotation;
  company: CompanySettings;
}

export function InvoiceDocument({ quotation, company }: Props) {
  const currency = quotation.currency === 'RIAL' ? 'ریال' : 'تومان';
  const letterhead = resolveLetterhead(company, quotation.letterheadType ?? 'MAIN');
  const isMisc = letterhead.type === 'MISC';
  const missingInfo =
    !isMisc &&
    (!letterhead.phone ||
      !letterhead.address ||
      !letterhead.nationalId ||
      !letterhead.economicCode ||
      !letterhead.logoDataUrl);

  return (
    <div className="space-y-3">
      {missingInfo && (
        <div className="no-print alert alert-warning">
          اطلاعات رسمی شرکت (لوگو، تلفن، نشانی، شناسه ملی یا کد اقتصادی) هنوز کامل نشده است. برای صدور
          سند رسمی، بخش «تنظیمات شرکت» را تکمیل کنید.
        </div>
      )}

      <div className="print-area card overflow-hidden p-5 text-[11px] leading-relaxed sm:p-7">
        {/* سربرگ */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-ink-900 p-4">
          <div className="flex items-center gap-3">
            {letterhead.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={letterhead.logoDataUrl}
                alt="لوگوی شرکت"
                className="h-12 w-12 rounded-lg object-contain"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-600 text-base font-extrabold text-white">
                آا
              </span>
            )}
            <div>
              <div className="doc-print-title text-base font-extrabold">
                {formatPersianText(letterhead.companyName)}
              </div>
              {letterhead.subtitle && (
                <div className="muted doc-print-muted text-[10px]">
                  {formatPersianText(letterhead.subtitle)}
                </div>
              )}
              <div className="muted numeric doc-print-muted mt-0.5 text-[10px]">
                {[
                  letterhead.phone ? toPersianDigits(letterhead.phone) : null,
                  letterhead.website,
                ]
                  .filter(Boolean)
                  .join(' | ') || 'اطلاعات تماس ثبت نشده'}
              </div>
            </div>
          </div>

          <div className="space-y-0.5 border-line text-right sm:border-r sm:pr-5 print:border-r print:pr-5">
            <div className="doc-print-subtitle text-sm font-bold">پیش‌فاکتور فروش کالا</div>
            <div>
              شماره:{' '}
              <span className="numeric font-bold">
                {formatDocumentNumber(quotation.number)}
              </span>
            </div>
            <div className="numeric">تاریخ صدور: {formatJalali(quotation.issueDate)}</div>
            <div className="numeric">
              اعتبار تا: {formatJalali(quotation.validUntil)} ({formatNumber(quotation.validDays, 0)} روز)
            </div>
            <div className="doc-print-muted text-[10px] text-steel-600">
              وضعیت: {STATUS_LABEL[quotation.status]}
            </div>
          </div>
        </div>

        {/* فروشنده و خریدار */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1.5 border-b border-line pb-1.5 font-bold">مشخصات فروشنده</div>
            <div>نام شرکت / فروشنده: {formatPersianText(letterhead.companyName)}</div>
            {(letterhead.nationalId || letterhead.economicCode || letterhead.registrationNo || !isMisc) && (
              <div className="numeric">
                شناسه ملی: {letterhead.nationalId ? toPersianDigits(letterhead.nationalId) : 'تنظیم نشده'} · کد اقتصادی:{' '}
                {letterhead.economicCode ? toPersianDigits(letterhead.economicCode) : 'تنظیم نشده'}
                {letterhead.registrationNo
                  ? ` · شماره ثبت: ${toPersianDigits(letterhead.registrationNo)}`
                  : ''}
              </div>
            )}
            <div className="numeric">
              تلفن:{' '}
              {[letterhead.phone, letterhead.secondaryPhone]
                .filter(Boolean)
                .map((p) => toPersianDigits(p!))
                .join(' · ') || 'تنظیم نشده'}
              {letterhead.email ? ` · ایمیل: ${letterhead.email}` : ''}
            </div>
            <div>نشانی: {letterhead.address ? formatPersianText(letterhead.address) : 'تنظیم نشده'}</div>
          </div>

          <div className="rounded-lg border border-line p-3">
            <div className="mb-1.5 border-b border-line pb-1.5 font-bold">مشخصات خریدار</div>
            <div>نام مشتری: {formatPersianText(quotation.customerName)}</div>
            {quotation.customerCompany && (
              <div>شرکت / پروژه: {formatPersianText(quotation.customerCompany)}</div>
            )}
            <div className="numeric">
              موبایل: <span dir="ltr">{toPersianDigits(quotation.customerMobile)}</span>
              {quotation.customerPhone ? (
                <>
                  {' '}
                  · تلفن دوم: <span dir="ltr">{toPersianDigits(quotation.customerPhone)}</span>
                </>
              ) : null}
            </div>
            {(quotation.customerNationalId || quotation.customerEconomicCode) && (
              <div className="numeric">
                {quotation.customerNationalId
                  ? `شناسه / کد ملی: ${toPersianDigits(quotation.customerNationalId)}`
                  : ''}
                {quotation.customerNationalId && quotation.customerEconomicCode ? ' · ' : ''}
                {quotation.customerEconomicCode
                  ? `کد اقتصادی: ${toPersianDigits(quotation.customerEconomicCode)}`
                  : ''}
              </div>
            )}
            <div>
              نشانی:{' '}
              {[quotation.customerCity, quotation.customerAddress]
                .filter(Boolean)
                .map((part) => formatPersianText(part))
                .join(' — ') || '—'}
            </div>
          </div>
        </div>

        {/* جدول کالاها */}
        <div className="mt-3 overflow-hidden rounded-lg border border-ink-900">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-surface-2">
                <th className="border-l border-line print:border-steel-300 px-1.5 py-2 text-center">ردیف</th>
                <th className="border-l border-line print:border-steel-300 px-1.5 py-2 text-right">نام کالا</th>
                <th className="border-l border-line print:border-steel-300 px-1.5 py-2 text-right">مشخصات</th>
                <th className="border-l border-line print:border-steel-300 px-1.5 py-2 text-center">سایز</th>
                <th className="border-l border-line print:border-steel-300 px-1.5 py-2 text-center">واحد</th>
                <th className="border-l border-line print:border-steel-300 px-1.5 py-2 text-left">مقدار</th>
                <th className="border-l border-line print:border-steel-300 px-1.5 py-2 text-left">قیمت واحد</th>
                <th className="px-1.5 py-2 text-left">مبلغ کل</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item) => (
                <tr key={item.id} className="border-t border-line print:border-steel-300">
                  <td className="border-l border-line print:border-steel-300 px-1.5 py-1.5 text-center numeric">
                    {formatNumber(item.rowIndex, 0)}
                  </td>
                  <td className="border-l border-line print:border-steel-300 px-1.5 py-1.5 font-semibold">
                    {formatPersianText(item.productName)}
                    {item.sku && (
                      <div className="muted numeric doc-print-foot mt-0.5 text-[9px] font-normal" dir="ltr">
                        کد: {toPersianDigits(item.sku)}
                      </div>
                    )}
                  </td>
                  <td className="border-l border-line print:border-steel-300 px-1.5 py-1.5 text-steel-600">
                    {item.specs ? formatPersianText(item.specs) : '—'}
                  </td>
                  <td className="border-l border-line print:border-steel-300 px-1.5 py-1.5 text-center">
                    {item.size ? formatPersianText(item.size) : '—'}
                  </td>
                  <td className="border-l border-line print:border-steel-300 px-1.5 py-1.5 text-center">
                    {UNIT_LABEL[item.unit]}
                  </td>
                  <td className="border-l border-line print:border-steel-300 px-1.5 py-1.5 text-left numeric">
                    {formatNumber(item.quantity, 3)}
                  </td>
                  <td className="border-l border-line print:border-steel-300 px-1.5 py-1.5 text-left numeric">
                    {formatNumber(item.unitPrice, 0)}
                  </td>
                  <td className="px-1.5 py-1.5 text-left font-bold numeric">
                    {formatNumber(item.lineTotal, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* شرایط و مالی */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12 print:grid-cols-12">
          <div className="rounded-lg border border-line p-3 sm:col-span-7 print:col-span-7">
            <div className="mb-1 font-bold">شرایط پرداخت، تحویل و توضیحات</div>
            <div>شرایط پرداخت: {quotation.paymentTerms ? formatPersianText(quotation.paymentTerms) : '—'}</div>
            <div>شرایط تحویل: {quotation.deliveryTerms ? formatPersianText(quotation.deliveryTerms) : '—'}</div>
            {letterhead.bankInfo && <div>اطلاعات بانکی: {formatPersianText(letterhead.bankInfo)}</div>}
            {quotation.notes && <div>توضیحات: {formatPersianText(quotation.notes)}</div>}
          </div>

          <div className="rounded-lg border border-ink-900 bg-surface-2/50 p-3 sm:col-span-5 print:col-span-5">
            <div className="flex justify-between numeric">
              <span className="muted">جمع کل کالاها</span>
              <span>{formatNumber(quotation.itemsSubtotal, 0)}</span>
            </div>
            <div className="flex justify-between numeric">
              <span className="muted">هزینه حمل</span>
              <span>{formatNumber(quotation.transportCost, 0)}</span>
            </div>
            <div className="flex justify-between numeric">
              <span className="muted">تخفیف</span>
              <span className="text-danger">{formatNumber(quotation.discountAmount, 0)}</span>
            </div>
            <div className="flex justify-between numeric">
              <span className="muted">
                مالیات {quotation.includeVat ? `(${formatNumber(quotation.vatRate, 0)}٪)` : '(معاف)'}
              </span>
              <span>{formatNumber(quotation.vatAmount, 0)}</span>
            </div>
            {Number(quotation.totalWeightKg ?? 0) > 0 && (
              <div className="flex justify-between numeric">
                <span className="muted">وزن کل محموله</span>
                <span>{formatNumber(quotation.totalWeightKg ?? 0, 2)} کیلوگرم</span>
              </div>
            )}
            <div className="doc-print-total mt-1.5 flex items-center justify-between border-t-2 border-ink-900 pt-1.5 text-xs font-extrabold numeric">
              <span>مبلغ نهایی</span>
              <span>{formatCurrency(quotation.grandTotal, quotation.currency)}</span>
            </div>
            <p className="doc-print-muted mt-1 text-[10px] leading-relaxed">
              به حروف: {amountInWords(quotation.grandTotal, quotation.currency)}
            </p>
          </div>
        </div>

        {company.disclaimerText && (
          <div className="doc-print-muted mt-3 rounded-lg border border-line bg-surface-2/40 p-2.5 text-[10px] text-steel-600">
            <span className="font-semibold">سلب مسئولیت و شرایط اعتبار: </span>
            {formatPersianText(company.disclaimerText)}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-6">
          <div className="doc-print-sign flex h-24 flex-col justify-between rounded-lg border border-line p-3 text-center">
            <div className="font-semibold">مهر و امضای فروشنده</div>
            <div className="muted doc-print-muted text-[10px]">
              صادرکننده: {formatPersianText(quotation.createdByName)}
            </div>
          </div>
          <div className="doc-print-sign flex h-24 flex-col justify-between rounded-lg border border-line p-3 text-center">
            <div className="font-semibold">مهر و امضای خریدار</div>
            <div className="muted doc-print-muted text-[10px]">تأیید مبالغ و شرایط پیش‌فاکتور</div>
          </div>
        </div>

        <div className="muted doc-print-foot mt-3 border-t border-line pt-2 text-[9px]">
          {formatPersianText(letterhead.companyName)}
          {letterhead.phone ? ` — تلفن: ${toPersianDigits(letterhead.phone)}` : ''}
          {letterhead.website ? ` — ${letterhead.website}` : ''} · واحد پول: {currency}
        </div>
      </div>
    </div>
  );
}
