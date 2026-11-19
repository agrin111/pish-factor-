import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { BrandLogo } from '@/components/brand-logo';
import { LoginForm } from '@/components/login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  const company = await getCompanySettings();
  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#D7DEE5] bg-white shadow-sm">
        <div className="flex items-center gap-4 bg-[#172535] px-8 py-7 text-white">
          <BrandLogo logoDataUrl={company.logoDataUrl} size="lg" variant="light" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Aghrin PishFactor</h1>
            <p className="mt-1 text-xs text-slate-300">
              سامانه اختصاصی صدور پیش‌فاکتور و فروش شرکت آهن آگرین
            </p>
          </div>
        </div>

        <div className="space-y-5 p-8">
          <div className="space-y-1.5">
            <h2 className="text-base font-bold">ورود به پنل سازمانی</h2>
            <p className="text-xs leading-relaxed text-slate-500">
              برای دسترسی به داشبورد فروش، مشتریان، قیمت‌گذاری و صدور پیش‌فاکتور رسمی، با حساب
              کاربری مجاز خود وارد شوید.
            </p>
          </div>

          <LoginForm notice={params.notice} />

          <div className="flex items-center gap-2 border-t border-[#D7DEE5] pt-4 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#347C65]" />
            <span>
              دسترسی مبتنی بر نقش (مدیر سیستم / کارمند فروش) و ثبت خودکار تاریخچه عملیات فعال است.
            </span>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} {company.companyName} — نسخه ۱.۰
      </p>
    </div>
  );
}
