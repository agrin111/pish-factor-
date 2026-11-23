'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Save, Trash2 } from 'lucide-react';
import { saveCompanySettingsAction } from '@/actions/settings';
import { initialActionState } from '@/lib/forms';
import { SubmitButton } from '@/components/submit-button';
import { BrandLogo } from '@/components/brand-logo';
import { NumberField } from '@/components/number-field';

export interface SettingsInitial {
  companyName: string;
  subtitle: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  nationalId: string | null;
  economicCode: string | null;
  registrationNo: string | null;
  bankInfo: string | null;
  defaultPaymentTerms: string | null;
  defaultDeliveryTerms: string | null;
  defaultNotes: string | null;
  disclaimerText: string | null;
  currency: 'TOMAN' | 'RIAL';
  defaultVatRate: string;
  defaultIncludeVat: boolean;
  defaultValidDays: number;
  numberPrefix: string;
  logoDataUrl: string | null;
  miscCompanyName: string | null;
  miscSubtitle: string | null;
  miscPhone: string | null;
  miscSecondaryPhone: string | null;
  miscEmail: string | null;
  miscWebsite: string | null;
  miscAddress: string | null;
  miscNationalId: string | null;
  miscEconomicCode: string | null;
  miscRegistrationNo: string | null;
  miscBankInfo: string | null;
  miscLogoDataUrl: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpFrom: string | null;
  hasSmtpPass: boolean;
}

const TABS = [
  { id: 'general', label: 'سربرگ اصلی' },
  { id: 'misc', label: 'سربرگ متفرقه' },
  { id: 'defaults', label: 'پیش‌فرض‌های صدور' },
  { id: 'smtp', label: 'ایمیل و SMTP' },
] as const;

const panelProps = (index: number) => ({
  role: 'tabpanel' as const,
  id: `settings-panel-${TABS[index].id}`,
  'aria-labelledby': `settings-tab-${TABS[index].id}`,
  'data-settings-panel': index,
  className: 'space-y-4',
});

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveCompanySettingsAction, initialActionState);

  const [companyName, setCompanyName] = useState(initial.companyName);
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? '');
  const [numberPrefix, setNumberPrefix] = useState(initial.numberPrefix);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [secondaryPhone, setSecondaryPhone] = useState(initial.secondaryPhone ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [website, setWebsite] = useState(initial.website ?? '');
  const [nationalId, setNationalId] = useState(initial.nationalId ?? '');
  const [economicCode, setEconomicCode] = useState(initial.economicCode ?? '');
  const [registrationNo, setRegistrationNo] = useState(initial.registrationNo ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [bankInfo, setBankInfo] = useState(initial.bankInfo ?? '');

  const [currency, setCurrency] = useState<'TOMAN' | 'RIAL'>(initial.currency);
  const [defaultVatRate, setDefaultVatRate] = useState(initial.defaultVatRate);
  const [defaultValidDays, setDefaultValidDays] = useState(String(initial.defaultValidDays));
  const [defaultIncludeVat, setDefaultIncludeVat] = useState(initial.defaultIncludeVat);
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(initial.defaultPaymentTerms ?? '');
  const [defaultDeliveryTerms, setDefaultDeliveryTerms] = useState(
    initial.defaultDeliveryTerms ?? '',
  );
  const [defaultNotes, setDefaultNotes] = useState(initial.defaultNotes ?? '');
  const [disclaimerText, setDisclaimerText] = useState(initial.disclaimerText ?? '');

  const [logo, setLogo] = useState<string | null>(initial.logoDataUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [miscCompanyName, setMiscCompanyName] = useState(initial.miscCompanyName ?? '');
  const [miscSubtitle, setMiscSubtitle] = useState(initial.miscSubtitle ?? '');
  const [miscPhone, setMiscPhone] = useState(initial.miscPhone ?? '');
  const [miscSecondaryPhone, setMiscSecondaryPhone] = useState(initial.miscSecondaryPhone ?? '');
  const [miscEmail, setMiscEmail] = useState(initial.miscEmail ?? '');
  const [miscWebsite, setMiscWebsite] = useState(initial.miscWebsite ?? '');
  const [miscNationalId, setMiscNationalId] = useState(initial.miscNationalId ?? '');
  const [miscEconomicCode, setMiscEconomicCode] = useState(initial.miscEconomicCode ?? '');
  const [miscRegistrationNo, setMiscRegistrationNo] = useState(initial.miscRegistrationNo ?? '');
  const [miscAddress, setMiscAddress] = useState(initial.miscAddress ?? '');
  const [miscBankInfo, setMiscBankInfo] = useState(initial.miscBankInfo ?? '');
  const [miscLogo, setMiscLogo] = useState<string | null>(initial.miscLogoDataUrl);
  const [removeMiscLogo, setRemoveMiscLogo] = useState(false);
  const [miscFileError, setMiscFileError] = useState('');
  const miscFileRef = useRef<HTMLInputElement>(null);

  const [smtpHost, setSmtpHost] = useState(initial.smtpHost ?? '');
  const [smtpPort, setSmtpPort] = useState(String(initial.smtpPort ?? 587));
  const [smtpSecure, setSmtpSecure] = useState(initial.smtpSecure);
  const [smtpUser, setSmtpUser] = useState(initial.smtpUser ?? '');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState(initial.smtpFrom ?? '');
  const [clearSmtpPass, setClearSmtpPass] = useState(false);

  const [tab, setTab] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resubmitRef = useRef(false);

  const focusTab = (index: number) => {
    setTab(index);
    tabRefs.current[index]?.focus();
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(index === last ? 0 : index + 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(index === 0 ? last : index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(last);
    }
  };

  // فیلد الزامی داخل تب پنهان قابل فوکوس نیست و پیام اعتبارسنجی مرورگر نمایش داده نمی‌شود؛
  // با گرفتن رویداد invalid همان تب را فعال می‌کنیم و یک بار دیگر اعتبارسنجی را اجرا می‌کنیم.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const panel = target?.closest<HTMLElement>('[data-settings-panel]');
      const index = Number(panel?.dataset.settingsPanel);
      if (!panel || Number.isNaN(index)) return;
      setTab(index);
      if (index !== tab) resubmitRef.current = true;
    };
    form.addEventListener('invalid', handler, true);
    return () => form.removeEventListener('invalid', handler, true);
  }, [tab]);

  useEffect(() => {
    if (!resubmitRef.current) return;
    resubmitRef.current = false;
    formRef.current?.requestSubmit();
  }, [tab]);

  useEffect(() => {
    setCompanyName(initial.companyName);
    setSubtitle(initial.subtitle ?? '');
    setNumberPrefix(initial.numberPrefix);
    setPhone(initial.phone ?? '');
    setSecondaryPhone(initial.secondaryPhone ?? '');
    setEmail(initial.email ?? '');
    setWebsite(initial.website ?? '');
    setNationalId(initial.nationalId ?? '');
    setEconomicCode(initial.economicCode ?? '');
    setRegistrationNo(initial.registrationNo ?? '');
    setAddress(initial.address ?? '');
    setBankInfo(initial.bankInfo ?? '');
    setCurrency(initial.currency);
    setDefaultVatRate(initial.defaultVatRate);
    setDefaultValidDays(String(initial.defaultValidDays));
    setDefaultIncludeVat(initial.defaultIncludeVat);
    setDefaultPaymentTerms(initial.defaultPaymentTerms ?? '');
    setDefaultDeliveryTerms(initial.defaultDeliveryTerms ?? '');
    setDefaultNotes(initial.defaultNotes ?? '');
    setDisclaimerText(initial.disclaimerText ?? '');
    setLogo(initial.logoDataUrl);
    setRemoveLogo(false);

    setMiscCompanyName(initial.miscCompanyName ?? '');
    setMiscSubtitle(initial.miscSubtitle ?? '');
    setMiscPhone(initial.miscPhone ?? '');
    setMiscSecondaryPhone(initial.miscSecondaryPhone ?? '');
    setMiscEmail(initial.miscEmail ?? '');
    setMiscWebsite(initial.miscWebsite ?? '');
    setMiscNationalId(initial.miscNationalId ?? '');
    setMiscEconomicCode(initial.miscEconomicCode ?? '');
    setMiscRegistrationNo(initial.miscRegistrationNo ?? '');
    setMiscAddress(initial.miscAddress ?? '');
    setMiscBankInfo(initial.miscBankInfo ?? '');
    setMiscLogo(initial.miscLogoDataUrl);
    setRemoveMiscLogo(false);

    setSmtpHost(initial.smtpHost ?? '');
    setSmtpPort(String(initial.smtpPort ?? 587));
    setSmtpSecure(initial.smtpSecure);
    setSmtpUser(initial.smtpUser ?? '');
    setSmtpPass('');
    setSmtpFrom(initial.smtpFrom ?? '');
    setClearSmtpPass(false);
  }, [initial]);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const handleImageFile = (
    file: File | undefined,
    onLoaded: (dataUrl: string) => void,
    onError: (message: string) => void,
  ) => {
    onError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('فقط فایل تصویری مجاز است.');
      return;
    }
    if (file.size > 800_000) {
      onError('حجم تصویر باید کمتر از ۸۰۰ کیلوبایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLoaded(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="logoDataUrl" value={removeLogo ? '' : logo ?? ''} />
      <input type="hidden" name="removeLogo" value={removeLogo ? 'true' : 'false'} />
      <input type="hidden" name="miscLogoDataUrl" value={removeMiscLogo ? '' : miscLogo ?? ''} />
      <input type="hidden" name="removeMiscLogo" value={removeMiscLogo ? 'true' : 'false'} />

      {state.message && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            state.ok
              ? 'alert-success'
              : 'alert-danger'
          }`}
        >
          {state.message}
        </div>
      )}

      <div className="card p-1.5" role="tablist" aria-label="بخش‌های تنظیمات">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${item.id}`}
              aria-selected={tab === index}
              aria-controls={`settings-panel-${item.id}`}
              tabIndex={tab === index ? 0 : -1}
              onClick={() => setTab(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                tab === index
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'text-steel-500 hover:bg-surface hover:text-ink-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section {...panelProps(0)} hidden={tab !== 0}>
      <div className="card card-pad space-y-4">
        <div>
          <h2 className="section-title">سربرگ اصلی شرکت و لوگو</h2>
          <p className="muted mt-0.5 text-xs">
            اطلاعات رسمی که در پیش‌فاکتورهای دارای «سربرگ اصلی شرکت» و سربرگ اصلی نمایش داده می‌شود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <BrandLogo logoDataUrl={removeLogo ? null : logo} size="lg" />
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
              {logo && !removeLogo && (
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
              onChange={(event) =>
                handleImageFile(
                  event.target.files?.[0],
                  (dataUrl) => {
                    setLogo(dataUrl);
                    setRemoveLogo(false);
                  },
                  setFileError,
                )
              }
            />
            <p className="field-hint">
              PNG یا JPG، حداکثر ۸۰۰ کیلوبایت. لوگو در سربرگ سند و PDF استفاده می‌شود.
            </p>
            {fileError && <p className="field-error">{fileError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="companyName">
              نام شرکت *
            </label>
            <input
              id="companyName"
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
            <label className="label" htmlFor="subtitle">
              عنوان فرعی
            </label>
            <input
              id="subtitle"
              name="subtitle"
              className="input"
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="numberPrefix">
              پیش‌شماره شماره‌گذاری *
            </label>
            <input
              id="numberPrefix"
              name="numberPrefix"
              className="input"
              dir="ltr"
              value={numberPrefix}
              onChange={(event) => setNumberPrefix(event.target.value)}
              required
            />
            <p className="field-hint">نمونه شماره: {numberPrefix || initial.numberPrefix}-۱۴۰۵-۰۰۰۱</p>
          </div>
          <div>
            <label className="label" htmlFor="phone">
              شماره تماس
            </label>
            <input
              id="phone"
              name="phone"
              className="input"
              dir="ltr"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="secondaryPhone">
              شماره تماس دوم
            </label>
            <input
              id="secondaryPhone"
              name="secondaryPhone"
              className="input"
              dir="ltr"
              value={secondaryPhone}
              onChange={(event) => setSecondaryPhone(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              ایمیل
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="website">
              وب‌سایت
            </label>
            <input
              id="website"
              name="website"
              className="input"
              dir="ltr"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="nationalId">
              شناسه ملی
            </label>
            <input
              id="nationalId"
              name="nationalId"
              className="input numeric"
              dir="ltr"
              value={nationalId}
              onChange={(event) => setNationalId(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="economicCode">
              کد اقتصادی
            </label>
            <input
              id="economicCode"
              name="economicCode"
              className="input numeric"
              dir="ltr"
              value={economicCode}
              onChange={(event) => setEconomicCode(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="registrationNo">
              شماره ثبت
            </label>
            <input
              id="registrationNo"
              name="registrationNo"
              className="input numeric"
              dir="ltr"
              value={registrationNo}
              onChange={(event) => setRegistrationNo(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">
              نشانی
            </label>
            <input
              id="address"
              name="address"
              className="input"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="bankInfo">
            اطلاعات بانکی
          </label>
          <textarea
            id="bankInfo"
            name="bankInfo"
            className="textarea"
            rows={2}
            value={bankInfo}
            onChange={(event) => setBankInfo(event.target.value)}
            placeholder="نام بانک، شماره حساب، شبا، صاحب حساب"
          />
        </div>
      </div>
      </section>

      <section {...panelProps(1)} hidden={tab !== 1}>
      <div className="card card-pad space-y-4">
        <div>
          <h2 className="section-title">سربرگ متفرقه</h2>
          <p className="muted mt-0.5 text-xs">
            اطلاعات مستقل برای پیش‌فاکتورها و مکاتباتی که با «سربرگ متفرقه» صادر می‌شوند (مثلاً واحد
            فروش متفرقه، انبار یا برند دوم).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <BrandLogo logoDataUrl={removeMiscLogo ? null : miscLogo} size="lg" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => miscFileRef.current?.click()}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                انتخاب لوگوی متفرقه
              </button>
              {miscLogo && !removeMiscLogo && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setMiscLogo(null);
                    setRemoveMiscLogo(true);
                    if (miscFileRef.current) miscFileRef.current.value = '';
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف لوگو
                </button>
              )}
            </div>
            <input
              ref={miscFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) =>
                handleImageFile(
                  event.target.files?.[0],
                  (dataUrl) => {
                    setMiscLogo(dataUrl);
                    setRemoveMiscLogo(false);
                  },
                  setMiscFileError,
                )
              }
            />
            <p className="field-hint">اختیاری — برای نمایش در سربرگ متفرقه پیش‌فاکتور و نامه.</p>
            {miscFileError && <p className="field-error">{miscFileError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="miscCompanyName">
              نام / عنوان سربرگ متفرقه
            </label>
            <input
              id="miscCompanyName"
              name="miscCompanyName"
              className="input"
              value={miscCompanyName}
              onChange={(event) => setMiscCompanyName(event.target.value)}
              placeholder="مثلاً: بازرگانی / فروش آزاد"
            />
          </div>
          <div>
            <label className="label" htmlFor="miscSubtitle">
              عنوان فرعی متفرقه
            </label>
            <input
              id="miscSubtitle"
              name="miscSubtitle"
              className="input"
              value={miscSubtitle}
              onChange={(event) => setMiscSubtitle(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="miscPhone">
              شماره تماس متفرقه
            </label>
            <input
              id="miscPhone"
              name="miscPhone"
              className="input"
              dir="ltr"
              value={miscPhone}
              onChange={(event) => setMiscPhone(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="miscSecondaryPhone">
              شماره تماس دوم متفرقه
            </label>
            <input
              id="miscSecondaryPhone"
              name="miscSecondaryPhone"
              className="input"
              dir="ltr"
              value={miscSecondaryPhone}
              onChange={(event) => setMiscSecondaryPhone(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="miscEmail">
              ایمیل متفرقه
            </label>
            <input
              id="miscEmail"
              name="miscEmail"
              type="email"
              className="input"
              dir="ltr"
              value={miscEmail}
              onChange={(event) => setMiscEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="miscWebsite">
              وب‌سایت متفرقه
            </label>
            <input
              id="miscWebsite"
              name="miscWebsite"
              className="input"
              dir="ltr"
              value={miscWebsite}
              onChange={(event) => setMiscWebsite(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="miscNationalId">
              شناسه / کد ملی متفرقه
            </label>
            <input
              id="miscNationalId"
              name="miscNationalId"
              className="input numeric"
              dir="ltr"
              value={miscNationalId}
              onChange={(event) => setMiscNationalId(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="miscEconomicCode">
              کد اقتصادی متفرقه
            </label>
            <input
              id="miscEconomicCode"
              name="miscEconomicCode"
              className="input numeric"
              dir="ltr"
              value={miscEconomicCode}
              onChange={(event) => setMiscEconomicCode(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="miscRegistrationNo">
              شماره ثبت متفرقه
            </label>
            <input
              id="miscRegistrationNo"
              name="miscRegistrationNo"
              className="input numeric"
              dir="ltr"
              value={miscRegistrationNo}
              onChange={(event) => setMiscRegistrationNo(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="miscAddress">
              نشانی متفرقه
            </label>
            <input
              id="miscAddress"
              name="miscAddress"
              className="input"
              value={miscAddress}
              onChange={(event) => setMiscAddress(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="miscBankInfo">
            اطلاعات بانکی متفرقه
          </label>
          <textarea
            id="miscBankInfo"
            name="miscBankInfo"
            className="textarea"
            rows={2}
            value={miscBankInfo}
            onChange={(event) => setMiscBankInfo(event.target.value)}
            placeholder="نام بانک، شماره حساب، شماره کارت یا شبا برای سربرگ متفرقه"
          />
        </div>
      </div>

      </section>

      <section {...panelProps(2)} hidden={tab !== 2}>
      <div className="card card-pad space-y-4">
        <h2 className="section-title">پیش‌فرض‌های صدور پیش‌فاکتور</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="currency">
              واحد پول پیش‌فرض
            </label>
            <select
              id="currency"
              name="currency"
              className="select"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as 'TOMAN' | 'RIAL')}
            >
              <option value="TOMAN">تومان</option>
              <option value="RIAL">ریال</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="defaultVatRate">
              درصد مالیات پیش‌فرض
            </label>
            <NumberField
              id="defaultVatRate"
              name="defaultVatRate"
              className="input numeric"
              value={defaultVatRate}
              onValueChange={setDefaultVatRate}
            />
          </div>
          <div>
            <label className="label" htmlFor="defaultValidDays">
              مدت اعتبار پیش‌فرض (روز)
            </label>
            <NumberField
              id="defaultValidDays"
              name="defaultValidDays"
              allowDecimal={false}
              className="input numeric"
              value={defaultValidDays}
              onValueChange={setDefaultValidDays}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="defaultIncludeVat"
                checked={defaultIncludeVat}
                onChange={(event) => setDefaultIncludeVat(event.target.checked)}
                className="h-4 w-4"
              />
              اعمال مالیات به‌صورت پیش‌فرض
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="defaultPaymentTerms">
              شرایط پرداخت پیش‌فرض
            </label>
            <textarea
              id="defaultPaymentTerms"
              name="defaultPaymentTerms"
              className="textarea"
              rows={2}
              value={defaultPaymentTerms}
              onChange={(event) => setDefaultPaymentTerms(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="defaultDeliveryTerms">
              شرایط تحویل پیش‌فرض
            </label>
            <textarea
              id="defaultDeliveryTerms"
              name="defaultDeliveryTerms"
              className="textarea"
              rows={2}
              value={defaultDeliveryTerms}
              onChange={(event) => setDefaultDeliveryTerms(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="defaultNotes">
              توضیحات پیش‌فرض
            </label>
            <textarea
              id="defaultNotes"
              name="defaultNotes"
              className="textarea"
              rows={2}
              value={defaultNotes}
              onChange={(event) => setDefaultNotes(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="disclaimerText">
              متن سلب مسئولیت و شرایط اعتبار
            </label>
            <textarea
              id="disclaimerText"
              name="disclaimerText"
              className="textarea"
              rows={2}
              value={disclaimerText}
              onChange={(event) => setDisclaimerText(event.target.value)}
              placeholder="این پیش‌فاکتور تا تاریخ اعتبار اعلام‌شده معتبر است و مبالغ آن تابع نرخ روز بازار است."
            />
          </div>
        </div>
      </div>

      </section>

      <section {...panelProps(3)} hidden={tab !== 3}>
      <div className="card card-pad space-y-4">
        <div>
          <h2 className="section-title">تنظیمات ارسال مستقیم ایمیل (SMTP — اختیاری)</h2>
          <p className="muted mt-0.5 text-xs">
            با تکمیل این بخش می‌توانید پیش‌فاکتورها را همراه با فایل PDF پیوست، مستقیماً از داخل
            برنامه ایمیل کنید (مثلاً برای جیمیل: سرور{' '}
            <span className="numeric" dir="ltr">
              smtp.gmail.com
            </span>{' '}
            پورت ۵۸۷ و رمز برنامه / App Password).
          </p>
        </div>

        <input type="hidden" name="clearSmtpPass" value={clearSmtpPass ? 'true' : 'false'} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="smtpHost">
              سرور SMTP
            </label>
            <input
              id="smtpHost"
              name="smtpHost"
              className="input"
              dir="ltr"
              placeholder="smtp.gmail.com"
              value={smtpHost}
              onChange={(event) => setSmtpHost(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="smtpPort">
              پورت
            </label>
            <NumberField
              id="smtpPort"
              name="smtpPort"
              allowDecimal={false}
              className="input numeric"
              value={smtpPort}
              onValueChange={setSmtpPort}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="smtpSecure"
                checked={smtpSecure}
                onChange={(event) => setSmtpSecure(event.target.checked)}
                className="h-4 w-4"
              />
              اتصال SSL مستقیم (معمولاً برای پورت ۴۶۵)
            </label>
          </div>
          <div>
            <label className="label" htmlFor="smtpUser">
              نام کاربری / ایمیل فرستنده
            </label>
            <input
              id="smtpUser"
              name="smtpUser"
              className="input"
              dir="ltr"
              placeholder="sales@company.com"
              value={smtpUser}
              onChange={(event) => setSmtpUser(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="smtpPass">
              رمز عبور SMTP / App Password
            </label>
            <input
              id="smtpPass"
              name="smtpPass"
              type="password"
              className="input"
              dir="ltr"
              autoComplete="new-password"
              placeholder={
                initial.hasSmtpPass && !clearSmtpPass
                  ? 'ذخیره شده — برای تغییر مقدار جدید وارد کنید'
                  : 'رمز ایمیل یا App Password'
              }
              value={smtpPass}
              onChange={(event) => {
                setSmtpPass(event.target.value);
                if (event.target.value) setClearSmtpPass(false);
              }}
            />
            {initial.hasSmtpPass && !clearSmtpPass && (
              <button
                type="button"
                onClick={() => {
                  setSmtpPass('');
                  setClearSmtpPass(true);
                }}
                className="mt-1 text-[11px] text-danger hover:underline"
              >
                حذف رمز ذخیره‌شده فعلی
              </button>
            )}
          </div>
          <div>
            <label className="label" htmlFor="smtpFrom">
              آدرس نمایش‌داده‌شده در From (اختیاری)
            </label>
            <input
              id="smtpFrom"
              name="smtpFrom"
              className="input"
              dir="ltr"
              placeholder="در صورت خالی بودن همان ایمیل کاربری استفاده می‌شود"
              value={smtpFrom}
              onChange={(event) => setSmtpFrom(event.target.value)}
            />
          </div>
        </div>
      </div>

      </section>

      <div className="flex justify-end">
        <SubmitButton className="btn btn-primary">
          <Save className="h-4 w-4" />
          ذخیره تنظیمات
        </SubmitButton>
      </div>
    </form>
  );
}
