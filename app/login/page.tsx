import { redirect } from 'next/navigation';
import { BarChart3, FileText, ShieldCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { BrandLogo } from '@/components/brand-logo';
import { LoginForm } from '@/components/login-form';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-[#347C65]/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-15%] left-[-8%] h-[460px] w-[460px] rounded-full bg-[#172535]/10 blur-3xl"
      />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_40px_100px_-50px_rgba(23,37,53,0.55)] lg:grid-cols-[1.05fr_1fr]">
        {/* پنل برند */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#172535] p-10 text-white lg:flex">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(120% 90% at 85% 8%, rgba(52,124,101,0.55), transparent 58%), linear-gradient(160deg, rgba(255,255,255,0.05), transparent 45%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to left, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '38px 38px',
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <BrandLogo logoDataUrl={company.logoDataUrl} size="md" variant="light" />
              <div>
                <div className="text-sm font-extrabold">Aghrin PishFactor</div>
                <div className="text-[11px] text-slate-300">{company.companyName}</div>
              </div>
            </div>

            <h1 className="mt-10 text-2xl font-extrabold leading-snug">
              صدور پیش‌فاکتور،
              <br />
              دقیق و حرفه‌ای.
            </h1>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-300">
              سامانه اختصاصی فروش و قیمت‌گذاری شرکت آهن آگرین؛ از ثبت مشتری تا سند رسمی قابل ارائه
              به مشتری.
            </p>
          </div>

          <div className="relative mt-10 space-y-4">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icon className="h-4 w-4 text-[#7fcbb2]" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold">{item.title}</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                      {item.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-10 border-t border-white/10 pt-4 text-[11px] text-slate-400">
            نسخه ۱.۰ — دسترسی فقط برای کاربران مجاز شرکت
          </div>
        </div>

        {/* فرم ورود */}
        <div className="p-7 sm:p-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandLogo logoDataUrl={company.logoDataUrl} size="md" />
            <div>
              <div className="text-sm font-extrabold">Aghrin PishFactor</div>
              <div className="text-[11px] text-slate-500">{company.companyName}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">ورود به پنل سازمانی</h2>
            <p className="text-xs leading-relaxed text-slate-500">
              برای دسترسی به داشبورد فروش، مشتریان، قیمت‌گذاری و صدور پیش‌فاکتور رسمی، با حساب
              کاربری مجاز خود وارد شوید.
            </p>
          </div>

          <div className="mt-6">
            <LoginForm notice={params.notice} />
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-xl border border-[#D7DEE5] bg-[#F7F9FA] p-3 text-[11px] leading-relaxed text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#347C65]" />
            <span>
              دسترسی مبتنی بر نقش (مدیر سیستم / کارمند فروش) و ثبت خودکار تاریخچه عملیات فعال است.
            </span>
          </div>
        </div>
      </div>

      <p className="absolute bottom-3 text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} {company.companyName} — نسخه ۱.۰
      </p>
    </div>
  );
}
