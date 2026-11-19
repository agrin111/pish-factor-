'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { logoutAction } from '@/actions/auth';
import type { Role } from '@prisma/client';
import { formatJalaliLong } from '@/lib/jalali';

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
  { href: '/customers', label: 'مدیریت مشتریان', icon: Users, count: 'customers' as const },
  { href: '/products', label: 'مدیریت کالا و قیمت', icon: Package, count: 'products' as const },
  { href: '/reports', label: 'گزارش‌های فروش', icon: BarChart3 },
  { href: '/users', label: 'کاربران و لاگ فعالیت', icon: Shield, adminOnly: true },
  { href: '/settings', label: 'تنظیمات شرکت', icon: Building2, adminOnly: true },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'داشبورد',
  '/invoices': 'آرشیو پیش‌فاکتورها',
  '/customers': 'مدیریت مشتریان',
  '/products': 'مدیریت کالا و قیمت',
  '/reports': 'گزارش‌های فروش',
  '/users': 'کاربران و لاگ فعالیت',
  '/settings': 'تنظیمات شرکت',
};

export function AppShell({ user, companyName, logoDataUrl, counts, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user.role === 'ADMIN';

  const title =
    Object.entries(TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? 'Aghrin PishFactor';

  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logoutAction();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#F1F3F5]">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#172535]/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar-panel fixed inset-y-0 right-0 z-50 flex w-[266px] shrink-0 flex-col bg-[#172535] text-white lg:static ${
          mobileOpen ? 'open' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo logoDataUrl={logoDataUrl} size="sm" variant="light" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">Aghrin PishFactor</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-300">{companyName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
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

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="منوی اصلی">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const count = item.count ? counts[item.count] : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {count !== undefined && (
                  <span className="numeric text-xs text-slate-300">
                    {new Intl.NumberFormat('fa-IR').format(count)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.fullName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-300">
              <span>{isAdmin ? 'مدیر سیستم' : 'کارمند فروش'}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate text-[11px]" dir="ltr">
                {user.username}
              </span>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="btn btn-ghost w-full !text-slate-200 hover:!bg-white/10">
            <LogOut className="h-3.5 w-3.5" />
            <span>خروج امن از حساب</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#D7DEE5] bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-[#F1F3F5] lg:hidden"
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 truncate text-sm">
              <span className="text-slate-400">آهن آگرین</span>
              <span className="text-slate-300">/</span>
              <span className="truncate font-bold">{title}</span>
            </div>
          </div>
          <div className="numeric shrink-0 whitespace-nowrap text-xs text-slate-500">
            {formatJalaliLong(new Date())}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
