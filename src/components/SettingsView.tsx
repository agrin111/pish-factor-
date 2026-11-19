import React, { useState } from 'react';
import { Save, Check, Download, Upload } from 'lucide-react';
import {
  CompanySettings,
  CurrencyType,
  Customer,
  Product,
  ProductCategoryDoc,
  Quotation,
} from '../types';
import { downloadJsonBackup } from '../utils/formatters';

interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => Promise<void>;
  backupPayload: {
    settings: CompanySettings;
    categories: ProductCategoryDoc[];
    products: Product[];
    customers: Customer[];
    quotations: Quotation[];
  };
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  backupPayload,
}) => {
  const [form, setForm] = useState<CompanySettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [logoError, setLogoError] = useState('');

  const handleChange = <K extends keyof CompanySettings>(
    field: K,
    value: CompanySettings[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedNotice(false);
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    if (file.size > 40 * 1024) {
      setLogoError('حجم فایل لوگو باید کمتر از ۴۰ کیلوبایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleChange('logoDataUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleBackupDownload = () => {
    downloadJsonBackup(`aghrin-pishfactor-backup-${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      ...backupPayload,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-[#172535]">تنظیمات شرکت و پیش‌فرض‌های پیش‌فاکتور</h1>
        <p className="text-sm text-slate-500 mt-1">
          تمامی اطلاعات رسمی شرکت (شماره تماس، آدرس، لوگو، اطلاعات مالیاتی و بانکی) از این بخش در PDF
          رسمی درج می‌شوند.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-white border border-[#D7DEE5] rounded-xl p-6 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              نام شرکت *
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              زیرعنوان فعالیت شرکت
            </label>
            <input
              type="text"
              value={form.subtitle || ''}
              onChange={(e) => handleChange('subtitle', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              لوگوی شرکت (اختیاری - PNG/SVG حداکثر ۴۰ کیلوبایت)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-[#D7DEE5] rounded-lg hover:bg-[#F1F3F5] cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>انتخاب فایل لوگو</span>
                <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
              </label>
              {form.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => handleChange('logoDataUrl', '')}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  حذف لوگو و استفاده از لوگوی پیش‌فرض
                </button>
              )}
            </div>
            {logoError && <div className="text-xs text-rose-600 mt-1">{logoError}</div>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172535] mb-1.5">شماره تماس</label>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="درج شماره تماس واقعی شرکت"
              className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172535] mb-1.5">ایمیل</label>
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              dir="ltr"
              className="w-full px-3 py-2 text-sm font-mono-num border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172535] mb-1.5">وب‌سایت</label>
            <input
              type="text"
              value={form.website || ''}
              onChange={(e) => handleChange('website', e.target.value)}
              dir="ltr"
              className="w-full px-3 py-2 text-sm font-mono-num border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172535] mb-1.5">شناسه ملی</label>
            <input
              type="text"
              value={form.nationalId || ''}
              onChange={(e) => handleChange('nationalId', e.target.value)}
              className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172535] mb-1.5">شماره اقتصادی</label>
            <input
              type="text"
              value={form.economicCode || ''}
              onChange={(e) => handleChange('economicCode', e.target.value)}
              className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172535] mb-1.5">شماره ثبت</label>
            <input
              type="text"
              value={form.registrationNo || ''}
              onChange={(e) => handleChange('registrationNo', e.target.value)}
              className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">آدرس شرکت</label>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              اطلاعات بانکی (بانک، شماره حساب و شبا)
            </label>
            <input
              type="text"
              value={form.bankInfo || ''}
              onChange={(e) => handleChange('bankInfo', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#D7DEE5] grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172535] mb-1.5">واحد پول پیش‌فرض</label>
            <select
              value={form.currency}
              onChange={(e) => handleChange('currency', e.target.value as CurrencyType)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg bg-white"
            >
              <option value="تومان">تومان</option>
              <option value="ریال">ریال</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#172535] mb-1.5">
                نرخ مالیات (٪)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={form.defaultVatRate}
                onChange={(e) => handleChange('defaultVatRate', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172535] mb-1.5">
                اعتبار پیش‌فرض (روز)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.defaultValidDays}
                onChange={(e) => handleChange('defaultValidDays', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-[#172535] cursor-pointer">
              <input
                type="checkbox"
                checked={form.defaultIncludeVat}
                onChange={(e) => handleChange('defaultIncludeVat', e.target.checked)}
              />
              <span>اعمال مالیات ارزش افزوده به‌صورت پیش‌فرض در پیش‌فاکتور جدید</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              شرایط پیش‌فرض پرداخت
            </label>
            <input
              type="text"
              value={form.defaultPaymentTerms || ''}
              onChange={(e) => handleChange('defaultPaymentTerms', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              شرایط پیش‌فرض تحویل
            </label>
            <input
              type="text"
              value={form.defaultDeliveryTerms || ''}
              onChange={(e) => handleChange('defaultDeliveryTerms', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              متن پیش‌فرض توضیحات
            </label>
            <textarea
              rows={2}
              value={form.defaultNotes || ''}
              onChange={(e) => handleChange('defaultNotes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#172535] mb-1.5">
              متن سلب مسئولیت و شرایط اعتبار پیش‌فاکتور
            </label>
            <textarea
              rows={3}
              value={form.disclaimerText || ''}
              onChange={(e) => handleChange('disclaimerText', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#D7DEE5] flex flex-wrap items-center justify-between gap-3">
          <div>
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#347C65]">
                <Check className="w-4 h-4" />
                <span>تنظیمات شرکت با موفقیت در پایگاه‌داده ذخیره شد</span>
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#347C65] hover:bg-[#2c6a56] text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
          </button>
        </div>
      </form>

      {/* Off-site JSON Backup Download */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-[#172535]">پشتیبان‌گیری (Backup) از داده‌های سامانه</div>
          <div className="text-xs text-slate-500 mt-0.5">
            دریافت فایل JSON کامل شامل تنظیمات، دسته‌بندی‌ها، کالاها، مشتریان و پیش‌فاکتورها برای نگهداری
            خارج از سرور.
          </div>
        </div>
        <button
          type="button"
          onClick={handleBackupDownload}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#172535] hover:bg-slate-800 text-white rounded-lg cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>دانلود فایل بکاپ JSON</span>
        </button>
      </div>
    </div>
  );
};
