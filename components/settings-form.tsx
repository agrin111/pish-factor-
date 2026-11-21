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
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveCompanySettingsAction, initialActionState);
  const [logo, setLogo] = useState<string | null>(initial.logoDataUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) router.refresh();
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

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="logoDataUrl" value={removeLogo ? '' : logo ?? ''} />
      <input type="hidden" name="removeLogo" value={removeLogo ? 'true' : 'false'} />

      {state.message && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            state.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {state.message}
        </div>
      )}

      <div className="card card-pad space-y-4">
        <h2 className="section-title">هویت شرکت و لوگو</h2>

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
              onChange={(event) => handleFile(event.target.files?.[0])}
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
              defaultValue={initial.companyName}
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
            <input id="subtitle" name="subtitle" className="input" defaultValue={initial.subtitle ?? ''} />
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
              defaultValue={initial.numberPrefix}
              required
            />
            <p className="field-hint">نمونه شماره: {initial.numberPrefix}-۱۴۰۵-۰۰۰۱</p>
          </div>
          <div>
            <label className="label" htmlFor="phone">
              شماره تماس
            </label>
            <input id="phone" name="phone" className="input" dir="ltr" defaultValue={initial.phone ?? ''} />
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
              defaultValue={initial.secondaryPhone ?? ''}
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
              defaultValue={initial.email ?? ''}
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
              defaultValue={initial.website ?? ''}
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
              defaultValue={initial.nationalId ?? ''}
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
              defaultValue={initial.economicCode ?? ''}
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
              defaultValue={initial.registrationNo ?? ''}
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
              defaultValue={initial.address ?? ''}
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
            defaultValue={initial.bankInfo ?? ''}
            placeholder="نام بانک، شماره حساب، شبا، صاحب حساب"
          />
        </div>
      </div>

      <div className="card card-pad space-y-4">
        <h2 className="section-title">پیش‌فرض‌های صدور پیش‌فاکتور</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="currency">
              واحد پول
            </label>
            <select
              id="currency"
              name="currency"
              className="select"
              defaultValue={initial.currency}
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
              defaultValue={initial.defaultVatRate}
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
              defaultValue={String(initial.defaultValidDays)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="defaultIncludeVat"
                defaultChecked={initial.defaultIncludeVat}
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
              defaultValue={initial.defaultPaymentTerms ?? ''}
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
              defaultValue={initial.defaultDeliveryTerms ?? ''}
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
              defaultValue={initial.defaultNotes ?? ''}
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
              defaultValue={initial.disclaimerText ?? ''}
              placeholder="این پیش‌فاکتور تا تاریخ اعتبار اعلام‌شده معتبر است و مبالغ آن تابع نرخ روز بازار است."
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton className="btn btn-primary">
          <Save className="h-4 w-4" />
          ذخیره تنظیمات
        </SubmitButton>
      </div>
    </form>
  );
}
