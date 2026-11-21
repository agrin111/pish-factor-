import {
  amountInWords,
  formatCurrency,
  formatDocumentNumber,
  formatNumber,
} from '@/lib/format';
import { formatJalali } from '@/lib/jalali';
import { STATUS_LABEL, UNIT_LABEL } from '@/lib/labels';
import type { CompanySettings, QuotationStatus, UnitType } from '@prisma/client';

export interface DocumentQuotation {
  id: string;
  number: string;
  status: QuotationStatus;
  issueDate: Date;
  validUntil: Date;
  validDays: number;
  customerName: string;
  customerMobile: string;
  customerCompany: string | null;
  customerAddress: string | null;
  currency: 'TOMAN' | 'RIAL';
  includeVat: boolean;
  vatRate: string;
  itemsSubtotal: string;
  transportCost: string;
  discountAmount: string;
  vatAmount: string;
  grandTotal: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
  createdByName: string;
  items: {
    id: string;
    rowIndex: number;
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
  const missingInfo =
    !company.phone ||
    !company.address ||
    !company.nationalId ||
    !company.economicCode ||
    !company.logoDataUrl;

  return (
    <div className="space-y-3">
      {missingInfo && (
        <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          اطلاعات رسمی شرکت (لوگو، تلفن، نشانی، شناسه ملی یا کد اقتصادی) هنوز کامل نشده است. برای صدور
          سند رسمی، بخش «تنظیمات شرکت» را تکمیل کنید.
        </div>
      )}

      <div className="print-area card overflow-hidden p-5 text-[11px] leading-relaxed sm:p-7">
        {/* سربرگ */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-[#172535] p-4">
          <div className="flex items-center gap-3">
            {company.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoDataUrl}
                alt="لوگوی شرکت"
                className="h-12 w-12 rounded-lg object-contain"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#347C65] text-base font-extrabold text-white">
                آا
              </span>
            )}
            <div>
              <div className="text-base font-extrabold">{company.companyName}</div>
              {company.subtitle && <div className="muted text-[10px]">{company.subtitle}</div>}
              <div className="muted numeric mt-0.5 text-[10px]">
                {[company.phone, company.website].filter(Boolean).join(' | ') || 'اطلاعات تماس ثبت نشده'}
              </div>
            </div>
          </div>

          <div className="space-y-0.5 border-[#D7DEE5] text-left sm:border-r sm:pr-5">
            <div className="text-sm font-bold">پیش‌فاکتور فروش کالا</div>
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
            <div className="text-[10px] text-[#4A5A6A]">وضعیت: {STATUS_LABEL[quotation.status]}</div>
          </div>
        </div>

        {/* فروشنده و خریدار */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#D7DEE5] p-3">
            <div className="mb-1.5 border-b border-[#D7DEE5] pb-1.5 font-bold">مشخصات فروشنده</div>
            <div>نام شرکت: {company.companyName}</div>
            <div className="numeric">
              شناسه ملی: {company.nationalId || 'تنظیم نشده'} · کد اقتصادی:{' '}
              {company.economicCode || 'تنظیم نشده'}
            </div>
            <div className="numeric">تلفن: {company.phone || 'تنظیم نشده'}</div>
            <div>نشانی: {company.address || 'تنظیم نشده'}</div>
          </div>

          <div className="rounded-lg border border-[#D7DEE5] p-3">
            <div className="mb-1.5 border-b border-[#D7DEE5] pb-1.5 font-bold">مشخصات خریدار</div>
            <div>نام مشتری: {quotation.customerName}</div>
            {quotation.customerCompany && <div>شرکت / پروژه: {quotation.customerCompany}</div>}
            <div className="numeric" dir="ltr">
              موبایل: {quotation.customerMobile}
            </div>
            <div>نشانی: {quotation.customerAddress || '—'}</div>
          </div>
        </div>

        {/* جدول کالاها */}
        <div className="mt-3 overflow-hidden rounded-lg border border-[#172535]">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-[#F1F3F5]">
                <th className="border-l border-[#D7DEE5] px-1.5 py-2 text-center">ردیف</th>
                <th className="border-l border-[#D7DEE5] px-1.5 py-2 text-right">نام کالا</th>
                <th className="border-l border-[#D7DEE5] px-1.5 py-2 text-right">مشخصات</th>
                <th className="border-l border-[#D7DEE5] px-1.5 py-2 text-center">سایز</th>
                <th className="border-l border-[#D7DEE5] px-1.5 py-2 text-center">واحد</th>
                <th className="border-l border-[#D7DEE5] px-1.5 py-2 text-left">مقدار</th>
                <th className="border-l border-[#D7DEE5] px-1.5 py-2 text-left">قیمت واحد</th>
                <th className="px-1.5 py-2 text-left">مبلغ کل</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item) => (
                <tr key={item.id} className="border-t border-[#D7DEE5]">
                  <td className="border-l border-[#D7DEE5] px-1.5 py-1.5 text-center numeric">
                    {formatNumber(item.rowIndex, 0)}
                  </td>
                  <td className="border-l border-[#D7DEE5] px-1.5 py-1.5 font-semibold">
                    {item.productName}
                  </td>
                  <td className="border-l border-[#D7DEE5] px-1.5 py-1.5 text-[#4A5A6A]">
                    {item.specs || '—'}
                  </td>
                  <td className="border-l border-[#D7DEE5] px-1.5 py-1.5 text-center">
                    {item.size || '—'}
                  </td>
                  <td className="border-l border-[#D7DEE5] px-1.5 py-1.5 text-center">
                    {UNIT_LABEL[item.unit]}
                  </td>
                  <td className="border-l border-[#D7DEE5] px-1.5 py-1.5 text-left numeric">
                    {formatNumber(item.quantity, 3)}
                  </td>
                  <td className="border-l border-[#D7DEE5] px-1.5 py-1.5 text-left numeric">
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
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="rounded-lg border border-[#D7DEE5] p-3 sm:col-span-7">
            <div className="mb-1 font-bold">شرایط پرداخت، تحویل و توضیحات</div>
            <div>شرایط پرداخت: {quotation.paymentTerms || '—'}</div>
            <div>شرایط تحویل: {quotation.deliveryTerms || '—'}</div>
            {company.bankInfo && <div>اطلاعات بانکی: {company.bankInfo}</div>}
            {quotation.notes && <div>توضیحات: {quotation.notes}</div>}
          </div>

          <div className="rounded-lg border border-[#172535] bg-[#F1F3F5]/50 p-3 sm:col-span-5">
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
              <span className="text-rose-700">{formatNumber(quotation.discountAmount, 0)}</span>
            </div>
            <div className="flex justify-between numeric">
              <span className="muted">
                مالیات {quotation.includeVat ? `(${formatNumber(quotation.vatRate, 0)}٪)` : '(معاف)'}
              </span>
              <span>{formatNumber(quotation.vatAmount, 0)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t-2 border-[#172535] pt-1.5 text-xs font-extrabold numeric">
              <span>مبلغ نهایی</span>
              <span>{formatCurrency(quotation.grandTotal, quotation.currency)}</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed">
              به حروف: {amountInWords(quotation.grandTotal, quotation.currency)}
            </p>
          </div>
        </div>

        {company.disclaimerText && (
          <div className="mt-3 rounded-lg border border-[#D7DEE5] bg-[#F1F3F5]/40 p-2.5 text-[10px] text-[#4A5A6A]">
            <span className="font-semibold">سلب مسئولیت و شرایط اعتبار: </span>
            {company.disclaimerText}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-6">
          <div className="flex h-24 flex-col justify-between rounded-lg border border-[#D7DEE5] p-3 text-center">
            <div className="font-semibold">مهر و امضای فروشنده</div>
            <div className="muted text-[10px]">صادرکننده: {quotation.createdByName}</div>
          </div>
          <div className="flex h-24 flex-col justify-between rounded-lg border border-[#D7DEE5] p-3 text-center">
            <div className="font-semibold">مهر و امضای خریدار</div>
            <div className="muted text-[10px]">تأیید مبالغ و شرایط پیش‌فاکتور</div>
          </div>
        </div>

        <div className="muted mt-3 border-t border-[#D7DEE5] pt-2 text-[9px]">
          {company.companyName}
          {company.phone ? ` — ${company.phone}` : ''}
          {company.address ? ` — ${company.address}` : ''} · واحد پول: {currency}
        </div>
      </div>
    </div>
  );
}
