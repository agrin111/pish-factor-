import { redirect } from 'next/navigation';
import { BarChart3, FileText, ShieldCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { BrandLogo } from '@/components/brand-logo';
import { LoginForm } from '@/components/login-form';
import { toPersianDigits } from '@/lib/format';
import pkg from '@/package.json';

export const dynamic = 'force-dynamic';

const HIGHLIGHTS = [
  {
    icon: FileText,
    title: 'پیش‌فاکتور رسمی فارسی',
    text: 'سند A4 با سربرگ شرکت، جدول کالاها، مبلغ به حروف و PDF قابل چاپ',
  },
  {
    icon: BarChart3,
    title: 'گزارش و رهگیری فروش',
    text: 'داشبورد فروش، وضعیت اسناد و خروجی گزارش برای پیگیری روزانه',
  },
  {
    icon: ShieldCheck,
    title: 'دسترسی نقش‌بندی‌شده',
    text: 'مدیر سیستم و کارمند فروش، با ثبت خودکار تاریخچه عملیات',
  },
];

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-4 sm:p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_64px_-44px_rgba(15,26,36,0.5)] lg:grid-cols-[1.05fr_1fr]">
        {/* پنل برند */}
        <div className="relative hidden flex-col justify-between bg-ink-900 p-10 text-white lg:flex">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-accent-500" />

          <div>
            <div className="flex items-center gap-3">
              <BrandLogo logoDataUrl={company.logoDataUrl} size="md" variant="light" />
              <div>
                <div className="text-sm font-extrabold">Aghrin PishFactor</div>
                <div className="mt-0.5 text-[11px] text-steel-300">{company.companyName}</div>
              </div>
            </div>

            <h1 className="mt-10 text-2xl font-extrabold leading-snug">
              صدور پیش‌فاکتور،
              <br />
              دقیق و حرفه‌ای.
            </h1>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-steel-300">
              سامانه اختصاصی فروش و قیمت‌گذاری شرکت آهن آگرین؛ از ثبت مشتری تا سند رسمی قابل ارائه
              به مشتری.
            </p>
          </div>

          <div className="mt-10 space-y-4 border-t border-white/10 pt-6">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5">
                    <Icon className="h-4 w-4 text-accent-300" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold">{item.title}</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-steel-300">
                      {item.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-[11px] text-steel-400">
            نسخه {toPersianDigits(pkg.version)} — دسترسی فقط برای کاربران مجاز شرکت
          </div>
        </div>

        {/* فرم ورود */}
        <div className="p-7 sm:p-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandLogo logoDataUrl={company.logoDataUrl} size="md" />
            <div>
              <div className="text-sm font-extrabold">Aghrin PishFactor</div>
              <div className="mt-0.5 text-[11px] text-steel-500">{company.companyName}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-ink-900">ورود به پنل سازمانی</h2>
            <p className="text-xs leading-relaxed text-steel-500">
              برای دسترسی به داشبورد فروش، مشتریان، قیمت‌گذاری و صدور پیش‌فاکتور رسمی، با حساب
              کاربری مجاز خود وارد شوید.
            </p>
          </div>

          <div className="mt-6">
            <LoginForm notice={params.notice} />
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-[10px] border border-line bg-surface p-3 text-[11px] leading-relaxed text-steel-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
            <span>
              دسترسی مبتنی بر نقش (مدیر سیستم / کارمند فروش) و ثبت خودکار تاریخچه عملیات فعال است.
            </span>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-steel-500">
        © {new Date().getFullYear()} {company.companyName} — نسخه {toPersianDigits(pkg.version)}
      </p>
    </div>
  );
}
