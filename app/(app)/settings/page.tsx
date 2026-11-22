import { DatabaseBackup, ShieldAlert } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { SettingsForm } from '@/components/settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireAdmin();
  const company = await getCompanySettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">تنظیمات شرکت</h1>
        <p className="muted mt-1 text-xs">
          این اطلاعات در سربرگ و پایین تمام پیش‌فاکتورهای رسمی استفاده می‌شود. تا زمان تکمیل، عبارت
          «تنظیم نشده» در سند نمایش داده می‌شود.
        </p>
      </div>

      <div className="card card-pad flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-2 text-xs text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            لوگو، شماره تماس، نشانی، شناسه ملی و کد اقتصادی را با اطلاعات رسمی شرکت تکمیل کنید؛ اطلاعات
            ساختگی در سند درج نمی‌شود.
          </p>
        </div>
        <a href="/api/backup" download className="btn btn-navy">
          <DatabaseBackup className="h-4 w-4" />
          دانلود نسخه پشتیبان JSON
        </a>
      </div>

      <SettingsForm
        initial={{
          companyName: company.companyName,
          subtitle: company.subtitle,
          phone: company.phone,
          secondaryPhone: company.secondaryPhone,
          email: company.email,
          website: company.website,
          address: company.address,
          nationalId: company.nationalId,
          economicCode: company.economicCode,
          registrationNo: company.registrationNo,
          bankInfo: company.bankInfo,
          defaultPaymentTerms: company.defaultPaymentTerms,
          defaultDeliveryTerms: company.defaultDeliveryTerms,
          defaultNotes: company.defaultNotes,
          disclaimerText: company.disclaimerText,
          currency: company.currency,
          defaultVatRate: company.defaultVatRate.toString(),
          defaultIncludeVat: company.defaultIncludeVat,
          defaultValidDays: company.defaultValidDays,
          numberPrefix: company.numberPrefix,
          logoDataUrl: company.logoDataUrl,
          miscCompanyName: company.miscCompanyName,
          miscSubtitle: company.miscSubtitle,
          miscPhone: company.miscPhone,
          miscSecondaryPhone: company.miscSecondaryPhone,
          miscEmail: company.miscEmail,
          miscWebsite: company.miscWebsite,
          miscAddress: company.miscAddress,
          miscNationalId: company.miscNationalId,
          miscEconomicCode: company.miscEconomicCode,
          miscRegistrationNo: company.miscRegistrationNo,
          miscBankInfo: company.miscBankInfo,
          miscLogoDataUrl: company.miscLogoDataUrl,
          smtpHost: company.smtpHost,
          smtpPort: company.smtpPort ?? 587,
          smtpSecure: company.smtpSecure,
          smtpUser: company.smtpUser,
          smtpFrom: company.smtpFrom,
          hasSmtpPass: Boolean(company.smtpPass),
        }}
      />
    </div>
  );
}
