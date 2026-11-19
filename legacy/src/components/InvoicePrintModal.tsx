import React, { useEffect, useState } from 'react';
import { X, Printer, Pencil } from 'lucide-react';
import { CompanySettings, Quotation, QuotationItem } from '../types';
import { fetchQuotationItems } from '../services/firestoreService';
import { formatCurrency, formatNumber, numberToPersianWords } from '../utils/formatters';
import { BrandLogo } from './BrandLogo';

interface InvoicePrintModalProps {
  quotation: Quotation;
  company: CompanySettings;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  quotation,
  company,
  canEdit,
  onEdit,
  onClose,
}) => {
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const rows = await fetchQuotationItems(quotation.id);
        if (active) setItems(rows);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [quotation.id]);

  const missingCompanyFields = !company.phone || !company.address;

  return (
    <div className="fixed inset-0 z-50 bg-[#172535]/75 flex items-start justify-center p-3 sm:p-6 overflow-y-auto print-only-container">
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden print-only-container">
        {/* Toolbar (hidden on print) */}
        <div className="no-print px-6 py-3.5 bg-[#172535] text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">پیش‌نمایش رسمی A4 و خروجی PDF</span>
            <span className="text-xs text-slate-300 font-mono-num">
              {quotation.quotationNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>ویرایش</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#347C65] hover:bg-[#2c6a56] text-white rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ / ذخیره PDF رسمی</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {missingCompanyFields && (
          <div className="no-print px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
            توجه: شماره تماس، نشانی یا اطلاعات مالیاتی شرکت هنوز در بخش «تنظیمات شرکت» تکمیل نشده است.
          </div>
        )}

        {/* Official A4 Document */}
        <div className="p-6 sm:p-8 text-[#172535] bg-white space-y-4 text-xs leading-relaxed">
          {/* Header */}
          <div className="border-2 border-[#172535] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BrandLogo logoDataUrl={company.logoDataUrl} size="md" variant="dark" />
              <div>
                <div className="text-lg font-extrabold text-[#172535]">{company.companyName}</div>
                {company.subtitle && (
                  <div className="text-[11px] text-slate-600 mt-0.5">{company.subtitle}</div>
                )}
              </div>
            </div>

            <div className="border-t sm:border-t-0 sm:border-r border-[#D7DEE5] pt-2 sm:pt-0 sm:pr-5 space-y-0.5 tabular-nums">
              <div className="text-sm font-bold text-[#172535]">پیش‌فاکتور فروش کالا</div>
              <div>
                شماره پیش‌فاکتور:{' '}
                <span className="font-mono-num font-bold">{quotation.quotationNumber}</span>
              </div>
              <div>تاریخ صدور: {quotation.issueDateShamsi}</div>
              <div>
                تاریخ اعتبار: {quotation.validUntilShamsi} ({formatNumber(quotation.validDays)} روز)
              </div>
            </div>
          </div>

          {/* Seller & Buyer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="border border-[#D7DEE5] rounded-lg p-3.5 space-y-1">
              <div className="font-bold text-[#172535] border-b border-[#D7DEE5] pb-1.5 mb-1.5">
                مشخصات فروشنده
              </div>
              <div>
                <span className="text-slate-500">نام شرکت: </span>
                <span className="font-semibold">{company.companyName}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                <span>
                  <span className="text-slate-500">شناسه ملی: </span>
                  {company.nationalId || 'تنظیم نشده'}
                </span>
                <span>
                  <span className="text-slate-500">کد اقتصادی: </span>
                  {company.economicCode || 'تنظیم نشده'}
                </span>
                {company.registrationNo && (
                  <span>
                    <span className="text-slate-500">شماره ثبت: </span>
                    {company.registrationNo}
                  </span>
                )}
              </div>
              <div className="tabular-nums">
                <span className="text-slate-500">تلفن: </span>
                {company.phone || 'تنظیم نشده'}
                {company.website ? ` · ${company.website}` : ''}
              </div>
              <div>
                <span className="text-slate-500">نشانی: </span>
                {company.address || 'تنظیم نشده'}
              </div>
            </div>

            <div className="border border-[#D7DEE5] rounded-lg p-3.5 space-y-1">
              <div className="font-bold text-[#172535] border-b border-[#D7DEE5] pb-1.5 mb-1.5">
                مشخصات خریدار
              </div>
              <div>
                <span className="text-slate-500">نام مشتری: </span>
                <span className="font-semibold">{quotation.customerName}</span>
              </div>
              {quotation.customerCompanyOrProject && (
                <div>
                  <span className="text-slate-500">شرکت / پروژه: </span>
                  <span className="font-medium">{quotation.customerCompanyOrProject}</span>
                </div>
              )}
              <div className="tabular-nums">
                <span className="text-slate-500">شماره موبایل: </span>
                {quotation.customerMobile || '—'}
              </div>
              <div>
                <span className="text-slate-500">نشانی: </span>
                {quotation.customerAddress || '—'}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-[#172535] rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-slate-500">در حال بارگذاری جدول کالاها...</div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F3F5] border-b border-[#172535] text-[#172535]">
                    <th className="py-2 px-2 text-center border-l border-[#D7DEE5] w-10">ردیف</th>
                    <th className="py-2 px-2.5 text-right border-l border-[#D7DEE5]">نام کالا</th>
                    <th className="py-2 px-2.5 text-right border-l border-[#D7DEE5]">مشخصات</th>
                    <th className="py-2 px-2 text-center border-l border-[#D7DEE5]">سایز</th>
                    <th className="py-2 px-2 text-center border-l border-[#D7DEE5]">واحد</th>
                    <th className="py-2 px-2 text-left border-l border-[#D7DEE5]">مقدار</th>
                    <th className="py-2 px-2 text-left border-l border-[#D7DEE5]">
                      قیمت واحد ({quotation.currency})
                    </th>
                    <th className="py-2 px-2.5 text-left font-bold">
                      مبلغ کل ({quotation.currency})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7DEE5]">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 px-2 text-center border-l border-[#D7DEE5] tabular-nums">
                        {formatNumber(item.rowIndex)}
                      </td>
                      <td className="py-2 px-2.5 border-l border-[#D7DEE5] font-semibold text-[#172535]">
                        {item.productName}
                      </td>
                      <td className="py-2 px-2.5 border-l border-[#D7DEE5] text-slate-600">
                        {item.specs || '—'}
                      </td>
                      <td className="py-2 px-2 text-center border-l border-[#D7DEE5]">
                        {item.size || '—'}
                      </td>
                      <td className="py-2 px-2 text-center border-l border-[#D7DEE5]">
                        {item.unit}
                      </td>
                      <td className="py-2 px-2 text-left border-l border-[#D7DEE5] tabular-nums font-medium">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="py-2 px-2 text-left border-l border-[#D7DEE5] tabular-nums">
                        {formatNumber(item.unitPrice)}
                      </td>
                      <td className="py-2 px-2.5 text-left font-bold tabular-nums">
                        {formatNumber(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Financial & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-7 border border-[#D7DEE5] rounded-lg p-3.5 space-y-1.5">
              <div className="font-bold text-[#172535]">شرایط پرداخت، تحویل و اطلاعات حساب</div>
              <div>
                <span className="text-slate-500">شرایط پرداخت: </span>
                <span>{quotation.paymentTerms || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">شرایط تحویل: </span>
                <span>{quotation.deliveryTerms || '—'}</span>
              </div>
              {company.bankInfo && (
                <div>
                  <span className="text-slate-500">اطلاعات بانکی: </span>
                  <span className="tabular-nums">{company.bankInfo}</span>
                </div>
              )}
              {quotation.notes && (
                <div>
                  <span className="text-slate-500">توضیحات: </span>
                  <span>{quotation.notes}</span>
                </div>
              )}
            </div>

            <div className="sm:col-span-5 border border-[#172535] rounded-lg p-3.5 space-y-1.5 bg-[#F1F3F5]/40">
              <div className="flex justify-between tabular-nums">
                <span className="text-slate-600">جمع کل کالاها:</span>
                <span className="font-medium">
                  {formatCurrency(quotation.itemsSubtotal, quotation.currency)}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span className="text-slate-600">هزینه حمل:</span>
                <span className="font-medium">
                  {formatCurrency(quotation.transportCost, quotation.currency)}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span className="text-slate-600">تخفیف:</span>
                <span className="font-medium text-rose-700">
                  {formatCurrency(quotation.discountAmount, quotation.currency)}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span className="text-slate-600">
                  مالیات ({quotation.includeVat ? `${formatNumber(quotation.vatRate)}٪` : 'معاف'}):
                </span>
                <span className="font-medium">
                  {formatCurrency(quotation.vatAmount, quotation.currency)}
                </span>
              </div>
              <div className="pt-2 border-t-2 border-[#172535] flex justify-between items-center text-sm font-extrabold tabular-nums">
                <span>مبلغ نهایی:</span>
                <span>{formatCurrency(quotation.grandTotal, quotation.currency)}</span>
              </div>
              <div className="pt-1 text-[11px] text-slate-700 leading-snug">
                <span className="font-semibold">به حروف: </span>
                {numberToPersianWords(quotation.grandTotal)} {quotation.currency}
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          {company.disclaimerText && (
            <div className="border border-[#D7DEE5] rounded-lg p-3 bg-[#F1F3F5]/40 text-[11px] text-slate-600">
              <span className="font-semibold text-[#172535]">سلب مسئولیت و شرایط اعتبار: </span>
              {company.disclaimerText}
            </div>
          )}

          {/* Signature & Stamp */}
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div className="border border-[#D7DEE5] rounded-lg p-4 h-24 flex flex-col justify-between text-center">
              <div className="font-semibold text-[#172535]">مهر و امضای فروشنده</div>
              <div className="text-[11px] text-slate-400">
                صادرکننده: {quotation.createdByName}
              </div>
            </div>
            <div className="border border-[#D7DEE5] rounded-lg p-4 h-24 flex flex-col justify-between text-center">
              <div className="font-semibold text-[#172535]">مهر و امضای خریدار</div>
              <div className="text-[11px] text-slate-400">تایید شرایط و مبالغ پیش‌فاکتور</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
