import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  BarChart3,
  Shield,
  Building2,
  Plus,
  LogOut,
  X,
} from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onCreateInvoice: () => void;
  onSignOut: () => void;
  currentUser: UserProfile;
  companyName: string;
  logoDataUrl?: string;
  invoiceCount: number;
  productCount: number;
  customerCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onCreateInvoice,
  onSignOut,
  currentUser,
  companyName,
  logoDataUrl,
  invoiceCount,
  productCount,
  customerCount,
  mobileOpen,
  onCloseMobile,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: 'داشبورد',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'invoices',
      label: 'آرشیو پیش‌فاکتورها',
      icon: <FileText className="w-4 h-4 shrink-0" />,
      count: invoiceCount,
    },
    {
      id: 'customers',
      label: 'مدیریت مشتریان',
      icon: <Users className="w-4 h-4 shrink-0" />,
      count: customerCount,
    },
    {
      id: 'products',
      label: 'مدیریت کالا و قیمت',
      icon: <Package className="w-4 h-4 shrink-0" />,
      count: productCount,
    },
    {
      id: 'reports',
      label: 'گزارش‌های فروش',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'users',
      label: 'کاربران و لاگ فعالیت',
      icon: <Shield className="w-4 h-4 shrink-0" />,
      adminOnly: true,
    },
    {
      id: 'settings',
      label: 'تنظیمات شرکت',
      icon: <Building2 className="w-4 h-4 shrink-0" />,
      adminOnly: true,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const handleNav = (id: ActiveTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#172535]/50 lg:hidden no-print"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`no-print fixed lg:static inset-y-0 right-0 z-50 w-[264px] shrink-0 bg-[#172535] text-white flex flex-col border-l border-white/10 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo logoDataUrl={logoDataUrl} size="sm" variant="light" />
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-white truncate">
                Aghrin PishFactor
              </div>
              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                {companyName}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10"
            aria-label="بستن منو"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              onCreateInvoice();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#347C65] hover:bg-[#2c6a56] text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>صدور پیش‌فاکتور جدید</span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="منوی اصلی">
          {visibleItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums text-slate-300">
                    {new Intl.NumberFormat('fa-IR').format(item.count)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {currentUser.displayName}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 truncate">
              <span>{isAdmin ? 'مدیر سیستم' : 'کارمند فروش'}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate font-mono-num text-[11px]">{currentUser.email}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج امن از حساب</span>
          </button>
        </div>
      </aside>
    </>
  );
};
