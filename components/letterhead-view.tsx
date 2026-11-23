'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, FilePenLine, ImagePlus, Pencil, Save, Trash2, X } from 'lucide-react';
import type { LetterheadType } from '@prisma/client';
import { saveLetterheadAction } from '@/actions/settings';
import { initialActionState } from '@/lib/forms';
import { SubmitButton } from '@/components/submit-button';
import { BrandLogo } from '@/components/brand-logo';
import { PrintButton } from '@/components/print-button';
import type { ResolvedLetterhead } from '@/lib/settings';

interface Props {
  mainLetterhead: ResolvedLetterhead;
  miscLetterhead: ResolvedLetterhead;
  todayLabel: string;
  isAdmin: boolean;
}

export function LetterheadView({
  mainLetterhead,
  miscLetterhead,
  todayLabel,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LetterheadType>('MAIN');
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(saveLetterheadAction, initialActionState);

  const current = activeTab === 'MAIN' ? mainLetterhead : miscLetterhead;

  const [companyName, setCompanyName] = useState(current.companyName);
  const [subtitle, setSubtitle] = useState(current.subtitle ?? '');
  const [phone, setPhone] = useState(current.phone ?? '');
  const [secondaryPhone, setSecondaryPhone] = useState(current.secondaryPhone ?? '');
  const [email, setEmail] = useState(current.email ?? '');
  const [website, setWebsite] = useState(current.website ?? '');
  const [nationalId, setNationalId] = useState(current.nationalId ?? '');
  const [economicCode, setEconomicCode] = useState(current.economicCode ?? '');
  const [registrationNo, setRegistrationNo] = useState(current.registrationNo ?? '');
  const [address, setAddress] = useState(current.address ?? '');
  const [bankInfo, setBankInfo] = useState(current.bankInfo ?? '');
  const [logo, setLogo] = useState<string | null>(current.logoDataUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyName(current.companyName);
    setSubtitle(current.subtitle ?? '');
    setPhone(current.phone ?? '');
    setSecondaryPhone(current.secondaryPhone ?? '');
    setEmail(current.email ?? '');
    setWebsite(current.website ?? '');
    setNationalId(current.nationalId ?? '');
    setEconomicCode(current.economicCode ?? '');
    setRegistrationNo(current.registrationNo ?? '');
    setAddress(current.address ?? '');
    setBankInfo(current.bankInfo ?? '');
    setLogo(current.logoDataUrl);
    setRemoveLogo(false);
    setFileError('');
  }, [activeTab, mainLetterhead, miscLetterhead]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state, router]);

  const handleFile = (file: File | undefined) => {
    setFileError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFileError('فقط فایل تصویری مجاز است.');
      return;
    }
    if (file.size > 800_000) {
      setFileError('حجم تصویر باید کمتر از ۸۰۰ کیلوبایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result));
      setRemoveLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const contactLine = [
    phone ? `تلفن: ${phone}` : null,
    secondaryPhone || null,
    email || null,
    website || null,
  ]
    .filter(Boolean)
    .join('  |  ');

  const displayLogo = removeLogo ? null : logo;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">سربرگ‌های شرکت (اصلی و متفرقه)</h1>
          <p className="muted mt-1 text-xs">
            سربرگ اصلی شرکت و سربرگ متفرقه هر دو قابل ویرایش و چاپ هستند و در صدور پیش‌فاکتور قابل
            انتخاب‌اند.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditing((prev) => !prev)}
            >
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {editing ? 'بستن ویرایش' : 'ویرایش اطلاعات سربرگ'}
            </button>
          )}
          <PrintButton showPaperSelector label="چاپ سربرگ" className="btn btn-primary" />
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('MAIN')}
          className={`btn ${activeTab === 'MAIN' ? 'btn-navy' : 'btn-secondary'}`}
        >
          <Building2 className="h-4 w-4" />
          سربرگ اصلی شرکت
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('MISC')}
          className={`btn ${activeTab === 'MISC' ? 'btn-navy' : 'btn-secondary'}`}
        >
          <FilePenLine className="h-4 w-4" />
          سربرگ متفرقه
        </button>
      </div>

      {state.message && (
        <div
          className={`no-print rounded-xl border p-3 text-xs ${
            state.ok
              ? 'alert-success'
              : 'alert-danger'
          }`}
        >
          {state.message}
        </div>
      )}

      {editing && isAdmin && (
        <form action={formAction} className="no-print card card-pad space-y-4">
          <input type="hidden" name="target" value={activeTab} />
          <input type="hidden" name="logoDataUrl" value={removeLogo ? '' : logo ?? ''} />
          <input type="hidden" name="removeLogo" value={removeLogo ? 'true' : 'false'} />

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <h2 className="section-title">
              {activeTab === 'MAIN' ? 'ویرایش سربرگ اصلی شرکت' : 'ویرایش سربرگ متفرقه'}
            </h2>
            <span className="muted text-xs">
              تغییرات روی پیش‌فاکتورها و چاپ سربرگ اعمال می‌شود.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <BrandLogo logoDataUrl={displayLogo} size="lg" />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  انتخاب لوگو
                </button>
                {displayLogo && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      setLogo(null);
                      setRemoveLogo(true);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف لوگو
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              {fileError && <p className="field-error">{fileError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="lh-companyName">
                نام / عنوان سربرگ *
              </label>
              <input
                id="lh-companyName"
                name="companyName"
                className="input"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                required
              />
              {state.errors?.companyName && (
                <p className="field-error">{state.errors.companyName[0]}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="lh-subtitle">
                عنوان فرعی
              </label>
              <input
                id="lh-subtitle"
                name="subtitle"
                className="input"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lh-phone">
                شماره تماس
              </label>
              <input
                id="lh-phone"
                name="phone"
                className="input"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lh-secondaryPhone">
                شماره تماس دوم
              </label>
              <input
                id="lh-secondaryPhone"
                name="secondaryPhone"
                className="input"
                dir="ltr"
                value={secondaryPhone}
                onChange={(event) => setSecondaryPhone(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lh-email">
                ایمیل
              </label>
              <input
                id="lh-email"
                name="email"
                type="email"
                className="input"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lh-website">
                وب‌سایت
              </label>
              <input
                id="lh-website"
                name="website"
                className="input"
                dir="ltr"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lh-nationalId">
                شناسه ملی
              </label>
              <input
                id="lh-nationalId"
                name="nationalId"
                className="input numeric"
                dir="ltr"
                value={nationalId}
                onChange={(event) => setNationalId(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lh-economicCode">
                کد اقتصادی
              </label>
              <input
                id="lh-economicCode"
                name="economicCode"
                className="input numeric"
                dir="ltr"
                value={economicCode}
                onChange={(event) => setEconomicCode(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lh-registrationNo">
                شماره ثبت
              </label>
              <input
                id="lh-registrationNo"
                name="registrationNo"
                className="input numeric"
                dir="ltr"
                value={registrationNo}
                onChange={(event) => setRegistrationNo(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="lh-address">
                نشانی
              </label>
              <input
                id="lh-address"
                name="address"
                className="input"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="lh-bankInfo">
                اطلاعات بانکی
              </label>
              <textarea
                id="lh-bankInfo"
                name="bankInfo"
                className="textarea"
                rows={2}
                value={bankInfo}
                onChange={(event) => setBankInfo(event.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              انصراف
            </button>
            <SubmitButton className="btn btn-primary">
              <Save className="h-4 w-4" />
              ذخیره اطلاعات سربرگ
            </SubmitButton>
          </div>
        </form>
      )}

      <div className="print-area card mx-auto w-full max-w-[820px] p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-ink-900 pb-4">
          <div className="flex items-center gap-4">
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayLogo}
                alt="لوگوی سربرگ"
                className="h-16 w-16 rounded-lg object-contain"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent-600 text-xl font-extrabold text-white">
                آا
              </span>
            )}
            <div>
              <div className="text-lg font-extrabold">{companyName || 'بدون عنوان'}</div>
              {subtitle && <div className="muted text-[11px]">{subtitle}</div>}
              {contactLine && (
                <div className="numeric muted mt-1 text-[11px]" dir="auto">
                  {contactLine}
                </div>
              )}
            </div>
          </div>

          <div className="numeric space-y-0.5 text-[11px] sm:text-left">
            {nationalId && <div>شناسه ملی: {nationalId}</div>}
            {economicCode && <div>کد اقتصادی: {economicCode}</div>}
            {registrationNo && <div>شماره ثبت: {registrationNo}</div>}
            {address && <div className="max-w-[280px] leading-relaxed">{address}</div>}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-[11px]">
          <div className="numeric">تاریخ: {todayLabel}</div>
          <div className="flex items-baseline gap-1">
            <span>شماره:</span>
            <span className="inline-block w-40 border-b border-dotted border-ink-900" />
          </div>
        </div>

        <div className="mt-8 space-y-6" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, index) => (
            <div key={index} className="border-b border-dotted border-line" />
          ))}
        </div>

        <div className="numeric mt-8 border-t border-line pt-3 text-[10px] text-steel-600">
          {companyName}
          {phone ? ` — ${phone}` : ''}
          {website ? ` — ${website}` : ''}
          {address ? ` — ${address}` : ''}
        </div>
      </div>
    </div>
  );
}
