'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  Download,
  FilePenLine,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { UpdateToast } from '@/components/update-toast';
import { logoutAction } from '@/actions/auth';
import type { Role } from '@prisma/client';
import { formatJalaliLong } from '@/lib/jalali';
import { toPersianDigits } from '@/lib/format';
import type { DesktopUpdateState } from '@/types/desktop';

export interface ShellUser {
  id: string;
  fullName: string;
  username: string;
  role: Role;
}

interface AppShellProps {
  user: ShellUser;
  companyName: string;
  logoDataUrl?: string | null;
  counts: { invoices: number; customers: number; products: number };
  children: React.ReactNode;
}

const NAV = [
  { href: '/dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { href: '/invoices', label: 'آرشیو پیش‌فاکتورها', icon: FileText, count: 'invoices' as const },
  { href: '/letterhead', label: 'انتخاب سربرگ', icon: FilePenLine },
  { href: '/customers', label: 'مدیریت مشتریان', icon: Users, count: 'customers' as const },
  { href: '/products', label: 'مدیریت کالا و قیمت', icon: Package, count: 'products' as const },
  { href: '/reports', label: 'گزارش‌های فروش', icon: BarChart3 },
  { href: '/users', label: 'کاربران و لاگ فعالیت', icon: Shield, adminOnly: true },
  { href: '/settings', label: 'تنظیمات شرکت', icon: Building2, adminOnly: true },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'داشبورد',
  '/invoices': 'آرشیو پیش‌فاکتورها',
  '/letterhead': 'انتخاب سربرگ',
  '/customers': 'مدیریت مشتریان',
  '/products': 'مدیریت کالا و قیمت',
  '/reports': 'گزارش‌های فروش',
  '/users': 'کاربران و لاگ فعالیت',
  '/settings': 'تنظیمات شرکت',
};

const UPDATE_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg bg-accent-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60';

export function AppShell({ user, companyName, logoDataUrl, counts, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopState, setDesktopState] = useState<DesktopUpdateState | null>(null);
  const isAdmin = user.role === 'ADMIN';

  useEffect(() => {
    const bridge = window.pishfactorDesktop;
    if (!bridge?.isDesktop) return;
    let active = true;
    bridge
      .getUpdateState()
      .then((state) => {
        if (active) setDesktopState(state);
      })
      .catch(() => {});
    const unsubscribe = bridge.onUpdateState((state) => {
      if (active) setDesktopState(state);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleCheckUpdates = async () => {
    const bridge = window.pishfactorDesktop;
    if (!bridge) return;
    const next = await bridge.checkForUpdates();
    setDesktopState(next);
  };

  const title =
    Object.entries(TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? 'Aghrin PishFactor';

  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logoutAction();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-surface">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/55 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`no-print sidebar-panel fixed inset-y-0 right-0 z-50 flex w-[268px] shrink-0 flex-col border-l border-white/10 bg-ink-900 text-white lg:static ${
          mobileOpen ? 'open' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo logoDataUrl={logoDataUrl} size="sm" variant="light" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">Aghrin PishFactor</div>
              <div className="mt-0.5 truncate text-[11px] text-steel-400">{companyName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-steel-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="بستن منو"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/10 p-4">
          <Link
            href="/invoices/new"
            onClick={() => setMobileOpen(false)}
            className="btn btn-primary w-full"
          >
            <Plus className="h-4 w-4" />
            <span>صدور پیش‌فاکتور جدید</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="منوی اصلی">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const count = item.count ? counts[item.count] : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-steel-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-accent-500"
                  />
                )}
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? 'text-accent-300' : 'text-steel-400'}`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </span>
                {count !== undefined && (
                  <span className="numeric rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-steel-300">
                    {new Intl.NumberFormat('fa-IR').format(count)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          {desktopState && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="numeric text-[11px] text-steel-300">
                  نسخه {toPersianDigits(desktopState.currentVersion)}
                </span>
                {desktopState.status === 'downloaded' ? (
                  <button
                    type="button"
                    onClick={() => window.pishfactorDesktop?.installUpdate()}
                    className={UPDATE_BUTTON_CLASS}
                  >
                    <Download className="h-3 w-3" />
                    <span>
                      {desktopState.isPortable
                        ? 'جایگزینی و راه‌اندازی مجدد'
                        : 'نصب و راه‌اندازی مجدد'}
                    </span>
                  </button>
                ) : desktopState.status === 'available' ? (
                  <button
                    type="button"
                    onClick={() => window.pishfactorDesktop?.downloadUpdate?.()}
                    className={UPDATE_BUTTON_CLASS}
                  >
                    <Download className="h-3 w-3" />
                    <span>{desktopState.isPortable ? 'دریافت و جایگزینی' : 'دریافت و نصب'}</span>
                  </button>
                ) : desktopState.status === 'portable-available' ? (
                  <button
                    type="button"
                    onClick={() => window.pishfactorDesktop?.openReleasesPage()}
                    className={UPDATE_BUTTON_CLASS}
                  >
                    <Download className="h-3 w-3" />
                    <span>دریافت از گیت‌هاب</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      desktopState.status === 'checking' || desktopState.status === 'downloading'
                    }
                    onClick={handleCheckUpdates}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-steel-200 transition-colors hover:bg-white/15 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${desktopState.status === 'checking' ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {desktopState.status === 'checking'
                        ? 'در حال بررسی...'
                        : 'بررسی به‌روزرسانی'}
                    </span>
                  </button>
                )}
              </div>

              {desktopState.status === 'downloading' && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent-500 transition-all"
                    style={{ width: `${desktopState.percent ?? 0}%` }}
                  />
                </div>
              )}

              {desktopState.message && (
                <p
                  className={`mt-2 text-[11px] leading-relaxed ${
                    desktopState.status === 'error'
                      ? 'text-accent-300'
                      : desktopState.status === 'downloaded' ||
                          desktopState.status === 'portable-available'
                        ? 'text-accent-300'
                        : 'text-steel-300'
                  }`}
                >
                  {desktopState.message}
                </p>
              )}
            </div>
          )}

          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{user.fullName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-steel-400">
              <span>{isAdmin ? 'مدیر سیستم' : 'کارمند فروش'}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate text-[11px]" dir="ltr">
                {user.username}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-ghost w-full border border-white/10 !text-steel-200 hover:!bg-white/10 hover:!text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>خروج امن از حساب</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-steel-600 hover:bg-surface lg:hidden"
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="مسیر صفحه" className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-steel-400">آهن آگرین</span>
              <span aria-hidden="true" className="text-steel-300">
                /
              </span>
              <span className="truncate font-bold text-ink-900">{title}</span>
            </nav>
          </div>
          <div className="numeric shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-steel-500">
            {formatJalaliLong(new Date())}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-6 lg:px-8 lg:py-7 print:m-0 print:max-w-none print:p-0">
          {children}
        </main>
      </div>

      <UpdateToast
        state={desktopState}
        onUpdate={() => void window.pishfactorDesktop?.downloadUpdate?.()}
        onInstall={() => void window.pishfactorDesktop?.installUpdate()}
        onOpenReleases={() => void window.pishfactorDesktop?.openReleasesPage()}
        onRetryCheck={() => void handleCheckUpdates()}
      />
    </div>
  );
}
