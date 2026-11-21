import { FilePenLine } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { PrintButton } from '@/components/print-button';
import { formatJalaliLong } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/**
 * سربرگ متفرقه: برگ رسمی شرکت برای مکاتبات و اسناد غیر از پیش‌فاکتور.
 * لوگو و اطلاعات شرکت از «تنظیمات شرکت» خوانده می‌شود؛ پیش‌فاکتور همچنان
 * سربرگ اصلی خودش را دارد.
 */
export default async function LetterheadPage() {
  await requireUser();
  const company = await getCompanySettings();

  const contactLine = [
    company.phone ? `تلفن: ${company.phone}` : null,
    company.secondaryPhone,
    company.email,
    company.website,
  ]
    .filter(Boolean)
    .join('  |  ');

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">سربرگ متفرقه</h1>
          <p className="muted mt-1 text-xs">
            برگ رسمی شرکت برای مکاتبات و اسناد غیر از پیش‌فاکتور. لوگو و اطلاعات از «تنظیمات شرکت»
            خوانده می‌شود.
          </p>
        </div>
        <PrintButton label="چاپ سربرگ" />
      </div>

      <div className="print-area card mx-auto w-full max-w-[820px] p-6 sm:p-10">
        {/* سربرگ اصلی شرکت */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-[#172535] pb-4">
          <div className="flex items-center gap-4">
            {company.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoDataUrl}
                alt="لوگوی شرکت"
                className="h-16 w-16 rounded-lg object-contain"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-[#347C65] text-xl font-extrabold text-white">
                آا
              </span>
            )}
            <div>
              <div className="text-lg font-extrabold">{company.companyName}</div>
              {company.subtitle && <div className="muted text-[11px]">{company.subtitle}</div>}
              {contactLine && (
                <div className="numeric muted mt-1 text-[11px]" dir="auto">
                  {contactLine}
                </div>
              )}
            </div>
          </div>

          <div className="numeric space-y-0.5 text-[11px] sm:text-left">
            {company.nationalId && <div>شناسه ملی: {company.nationalId}</div>}
            {company.economicCode && <div>کد اقتصادی: {company.economicCode}</div>}
            {company.registrationNo && <div>شماره ثبت: {company.registrationNo}</div>}
            {company.address && <div className="max-w-[280px] leading-relaxed">{company.address}</div>}
          </div>
        </div>

        {/* تاریخ و شماره نامه */}
        <div className="mt-5 flex items-center justify-between text-[11px]">
          <div className="numeric">تاریخ: {formatJalaliLong(new Date())}</div>
          <div className="flex items-baseline gap-1">
            <span>شماره:</span>
            <span className="inline-block w-40 border-b border-dotted border-[#172535]" />
          </div>
        </div>

        {/* محل نگارش متن */}
        <div className="mt-8 space-y-6" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, index) => (
            <div key={index} className="border-b border-dotted border-[#D7DEE5]" />
          ))}
        </div>

        {/* پایین برگ */}
        <div className="numeric mt-8 border-t border-[#D7DEE5] pt-3 text-[10px] text-[#4A5A6A]">
          {company.companyName}
          {company.phone ? ` — ${company.phone}` : ''}
          {company.website ? ` — ${company.website}` : ''}
          {company.address ? ` — ${company.address}` : ''}
        </div>
      </div>

      {(!company.logoDataUrl || !company.address || !company.phone) && (
        <p className="no-print flex items-center gap-2 text-xs text-amber-800">
          <FilePenLine className="h-4 w-4" />
          برای سربرگ کامل، لوگو، تلفن و نشانی شرکت را در بخش «تنظیمات شرکت» تکمیل کنید.
        </p>
      )}
    </div>
  );
}
