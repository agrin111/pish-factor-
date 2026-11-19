import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatJalali, jalaliToDate, toJalali, todayUtc } from '@/lib/jalali';
import { formatCurrency, formatNumber, toNumber } from '@/lib/format';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/labels';
import { effectiveStatus } from '@/lib/quotation-status';
import { getCompanySettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export default async function DashboardPage() {
  const user = await requireUser();
  const company = await getCompanySettings();
  const currency = company.currency;

  const today = todayUtc();
  const startOfToday = new Date(today);
  const startOfTomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const { jy, jm } = toJalali(today);
  const monthsBack: { jy: number; jm: number; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    let month = jm - i;
    let year = jy;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    const start = jalaliToDate(year, month, 1);
    const end =
      month === 12 ? jalaliToDate(year + 1, 1, 1) : jalaliToDate(year, month + 1, 1);
    monthsBack.push({ jy: year, jm: month, start, end });
  }

  const [total, todayCount, statusGroups, amountAgg, recent, customers, chartRows] =
    await Promise.all([
      prisma.quotation.count(),
      prisma.quotation.count({
        where: { issueDate: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      prisma.quotation.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.quotation.aggregate({
        _sum: { grandTotal: true },
        where: { status: { not: 'CANCELLED' } },
      }),
      prisma.quotation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          number: true,
          customerName: true,
          grandTotal: true,
          status: true,
          validUntil: true,
          issueDate: true,
          currency: true,
        },
      }),
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, mobile: true, companyOrProject: true, createdAt: true },
      }),
      prisma.quotation.findMany({
        where: { issueDate: { gte: monthsBack[0].start } },
        select: { issueDate: true, grandTotal: true, status: true },
      }),
    ]);

  const countByStatus = new Map(statusGroups.map((row) => [row.status, row._count._all]));
  const expiredDerived = await prisma.quotation.count({
    where: { status: 'SENT', validUntil: { lt: new Date() } },
  });

  const pending = Math.max(0, (countByStatus.get('SENT') ?? 0) - expiredDerived);
  const approved = countByStatus.get('APPROVED') ?? 0;
  const cancelled = countByStatus.get('CANCELLED') ?? 0;
  const expired = (countByStatus.get('EXPIRED') ?? 0) + expiredDerived;
  const drafts = countByStatus.get('DRAFT') ?? 0;

  const monthly = monthsBack.map((month) => {
    const rows = chartRows.filter(
      (row) =>
        row.issueDate >= month.start &&
        row.issueDate < month.end &&
        row.status !== 'CANCELLED',
    );
    const sum = rows.reduce((acc, row) => acc + toNumber(row.grandTotal), 0);
    return { label: MONTHS[month.jm - 1], count: rows.length, sum };
  });

  const maxSum = Math.max(1, ...monthly.map((m) => m.sum));

  const stats = [
    {
      label: 'کل پیش‌فاکتورها',
      value: formatNumber(total, 0),
      hint: 'همه اسناد ثبت‌شده',
      icon: FileText,
      tone: 'text-[#172535]',
    },
    {
      label: 'پیش‌فاکتورهای امروز',
      value: formatNumber(todayCount, 0),
      hint: formatJalali(today),
      icon: TrendingUp,
      tone: 'text-[#347C65]',
    },
    {
      label: 'در انتظار پاسخ مشتری',
      value: formatNumber(pending, 0),
      hint: 'ارسال‌شده و معتبر',
      icon: Clock,
      tone: 'text-[#1D5D9B]',
    },
    {
      label: 'تأییدشده',
      value: formatNumber(approved, 0),
      hint: 'قابل تبدیل به فاکتور',
      icon: CheckCircle2,
      tone: 'text-[#256B52]',
    },
    {
      label: 'لغوشده',
      value: formatNumber(cancelled, 0),
      hint: 'اسناد لغو‌شده',
      icon: XCircle,
      tone: 'text-[#B42318]',
    },
    {
      label: 'منقضی‌شده',
      value: formatNumber(expired, 0),
      hint: 'پایان اعتبار',
      icon: Clock,
      tone: 'text-[#95610B]',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">داشبورد فروش</h1>
          <p className="muted mt-1 text-xs">
            {user.fullName} — {user.role === 'ADMIN' ? 'مدیر سیستم' : 'کارمند فروش'} · امروز{' '}
            <span className="numeric">{formatJalali(today)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/invoices/new" className="btn btn-primary">
            <Plus className="h-4 w-4" />
            صدور پیش‌فاکتور جدید
          </Link>
          <Link href="/reports" className="btn btn-secondary">
            گزارش‌های فروش
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card card-pad flex items-start justify-between gap-3">
              <div>
                <div className="muted text-xs">{stat.label}</div>
                <div className={`numeric mt-1 text-2xl font-extrabold ${stat.tone}`}>
                  {stat.value}
                </div>
                <div className="muted mt-1 text-[11px]">{stat.hint}</div>
              </div>
              <span className="rounded-lg bg-[#F1F3F5] p-2">
                <Icon className={`h-5 w-5 ${stat.tone}`} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card card-pad xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="section-title">روند فروش ۶ ماه اخیر</h2>
            <span className="muted text-[11px]">مبالغ پیش‌فاکتورهای غیرلغوشده</span>
          </div>
          <div className="mt-4 flex h-44 items-end gap-2">
            {monthly.map((month) => {
              const height = Math.max(4, Math.round((month.sum / maxSum) * 100));
              return (
                <div key={month.label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="numeric text-[10px] text-[#4A5A6A]">
                    {month.count ? formatNumber(month.sum / 1_000_000, 1) : '۰'}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-[#347C65]"
                      style={{ height: `${height}%` }}
                      title={`${month.label}: ${formatCurrency(month.sum, currency)}`}
                    />
                  </div>
                  <span className="text-[11px] text-[#4A5A6A]">{month.label}</span>
                </div>
              );
            })}
          </div>
          <p className="muted mt-2 text-[10px]">مقادیر ستون‌ها به میلیون تومان نمایش داده شده است.</p>
        </div>

        <div className="card card-pad">
          <h2 className="section-title">مجموع مبالغ پیش‌فاکتورها</h2>
          <p className="numeric mt-3 text-xl font-extrabold text-[#172535]">
            {formatCurrency(amountAgg._sum.grandTotal ?? 0, currency)}
          </p>
          <p className="muted mt-1 text-[11px]">بدون احتساب اسناد لغوشده</p>

          <div className="divider my-4" />

          <div className="flex items-center justify-between text-xs">
            <span className="muted">پیش‌نویس‌های در جریان</span>
            <span className="numeric font-semibold">{formatNumber(drafts, 0)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="muted">تعداد کل اسناد</span>
            <span className="numeric font-semibold">{formatNumber(total, 0)}</span>
          </div>

          <Link href="/invoices?status=SENT" className="btn btn-secondary mt-4 w-full">
            پیگیری پیش‌فاکتورهای در انتظار
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-[#D7DEE5] px-5 py-3.5">
            <h2 className="section-title">آخرین پیش‌فاکتورهای صادرشده</h2>
            <Link href="/invoices" className="text-xs font-semibold text-[#347C65] hover:underline">
              مشاهده آرشیو
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-[#6B7A88]">
              هنوز پیش‌فاکتوری صادر نشده است. با دکمه «صدور پیش‌فاکتور جدید» شروع کنید.
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF1F4]">
              {recent.map((row) => {
                const status = effectiveStatus(row);
                return (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${row.id}`}
                        className="numeric block truncate text-sm font-semibold hover:text-[#347C65]"
                      >
                        {row.number}
                      </Link>
                      <div className="muted mt-0.5 truncate text-[11px]">
                        {row.customerName} · {formatJalali(row.issueDate)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="numeric text-xs font-semibold">
                        {formatCurrency(row.grandTotal, row.currency)}
                      </span>
                      <span className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between border-b border-[#D7DEE5] px-5 py-3.5">
            <h2 className="section-title">آخرین مشتریان</h2>
            <Link href="/customers" className="text-xs font-semibold text-[#347C65] hover:underline">
              مدیریت
            </Link>
          </div>
          {customers.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-[#6B7A88]">
              هنوز مشتری ثبت نشده است.
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF1F4]">
              {customers.map((customer) => (
                <li key={customer.id} className="flex items-center gap-2.5 px-5 py-3">
                  <span className="rounded-full bg-[#F1F3F5] p-1.5">
                    <Users className="h-3.5 w-3.5 text-[#347C65]" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{customer.name}</div>
                    <div className="muted numeric truncate text-[11px]">
                      {customer.mobile}
                      {customer.companyOrProject ? ` · ${customer.companyOrProject}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
