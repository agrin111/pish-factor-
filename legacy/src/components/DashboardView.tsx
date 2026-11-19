import React, { useMemo } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Eye,
  Plus,
  ArrowUpLeft,
  Calendar,
} from 'lucide-react';
import { ActiveTab, CurrencyType, Customer, Quotation, QuotationStatus } from '../types';
import { formatCurrency, formatNumber, getShamsiDate } from '../utils/formatters';

interface DashboardViewProps {
  quotations: Quotation[];
  customers: Customer[];
  currency: CurrencyType;
  onNavigate: (tab: ActiveTab) => void;
  onCreateInvoice: () => void;
  onPreviewInvoice: (quotation: Quotation) => void;
}

const statusMeta: Record<QuotationStatus, { color: string; bar: string }> = {
  'پیش‌نویس': { color: 'text-slate-600', bar: 'bg-slate-400' },
  'ارسال‌شده': { color: 'text-amber-700', bar: 'bg-amber-500' },
  'تاییدشده': { color: 'text-[#347C65]', bar: 'bg-[#347C65]' },
  'لغوشده': { color: 'text-rose-700', bar: 'bg-rose-500' },
  'منقضی‌شده': { color: 'text-slate-500', bar: 'bg-slate-300' },
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  quotations,
  customers,
  currency,
  onNavigate,
  onCreateInvoice,
  onPreviewInvoice,
}) => {
  const todayShamsi = getShamsiDate();

  const stats = useMemo(() => {
    const totalCount = quotations.length;
    const todayCount = quotations.filter((q) => q.issueDateShamsi === todayShamsi).length;
    const pendingCount = quotations.filter((q) => q.status === 'ارسال‌شده').length;
    const approvedCount = quotations.filter((q) => q.status === 'تاییدشده').length;
    const cancelledCount = quotations.filter((q) => q.status === 'لغوشده').length;
    const expiredCount = quotations.filter((q) => q.status === 'منقضی‌شده').length;
    const draftCount = quotations.filter((q) => q.status === 'پیش‌نویس').length;

    const totalAmount = quotations
      .filter((q) => q.status !== 'لغوشده')
      .reduce((sum, q) => sum + (q.grandTotal || 0), 0);

    const approvedAmount = quotations
      .filter((q) => q.status === 'تاییدشده')
      .reduce((sum, q) => sum + (q.grandTotal || 0), 0);

    return {
      totalCount,
      todayCount,
      pendingCount,
      approvedCount,
      cancelledCount,
      expiredCount,
      draftCount,
      totalAmount,
      approvedAmount,
    };
  }, [quotations, todayShamsi]);

  // Group sales by Shamsi month (YYYY/MM) for bar chart
  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { label: string; total: number; approved: number; count: number }>();
    for (const q of quotations) {
      if (q.status === 'لغوشده') continue;
      const parts = (q.issueDateShamsi || '').split('/');
      const key = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : 'نامشخص';
      const entry = map.get(key) || { label: key, total: 0, approved: 0, count: 0 };
      entry.total += q.grandTotal || 0;
      if (q.status === 'تاییدشده') entry.approved += q.grandTotal || 0;
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).slice(-6);
  }, [quotations]);

  const maxChartAmount = Math.max(1, ...monthlyChartData.map((d) => d.total));
  const recentQuotations = quotations.slice(0, 6);
  const recentCustomers = customers.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172535]">داشبورد مدیریت فروش و پیش‌فاکتورها</h1>
          <p className="text-sm text-slate-500 mt-1">
            گزارش لحظه‌ای وضعیت پیش‌فاکتورها، مبالغ فروش و مشتریان ثبت‌شده
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateInvoice}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#347C65] hover:bg-[#2c6a56] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>صدور پیش‌فاکتور جدید</span>
        </button>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D7DEE5] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>مجموع مبالغ پیش‌فاکتورها</span>
            <TrendingUp className="w-4 h-4 text-[#347C65]" />
          </div>
          <div className="mt-3 text-xl font-bold text-[#172535] tabular-nums">
            {formatCurrency(stats.totalAmount, currency)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span>قطعی: {formatCurrency(stats.approvedAmount, currency)}</span>
          </div>
        </div>

        <div className="bg-white border border-[#D7DEE5] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>تعداد کل / پیش‌فاکتورهای امروز</span>
            <FileText className="w-4 h-4 text-[#172535]" />
          </div>
          <div className="mt-3 text-xl font-bold text-[#172535] tabular-nums">
            {formatNumber(stats.totalCount)} سند
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>امروز ({todayShamsi}): {formatNumber(stats.todayCount)} پیش‌فاکتور</span>
          </div>
        </div>

        <div className="bg-white border border-[#D7DEE5] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>در انتظار پاسخ / تأییدشده</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3 text-xl font-bold text-[#172535] tabular-nums">
            {formatNumber(stats.pendingCount)} در انتظار
          </div>
          <div className="mt-2 text-xs text-[#347C65] font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تأییدشده: {formatNumber(stats.approvedCount)} پیش‌فاکتور</span>
          </div>
        </div>

        <div className="bg-white border border-[#D7DEE5] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>لغوشده / منقضی‌شده</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3 text-xl font-bold text-[#172535] tabular-nums">
            {formatNumber(stats.cancelledCount)} لغوشده
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            <span>منقضی‌شده: {formatNumber(stats.expiredCount)} · پیش‌نویس: {formatNumber(stats.draftCount)}</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#D7DEE5] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#172535]">نمودار آماری مبالغ پیش‌فاکتورها</h2>
              <p className="text-xs text-slate-500 mt-0.5">مقایسه کل مبالغ صادره با مبالغ تأییدشده در هر ماه</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#172535]/20 inline-block" />
                کل صادره
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#347C65] inline-block" />
                تأییدشده
              </span>
            </div>
          </div>

          {monthlyChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400 border border-dashed border-[#D7DEE5] rounded-lg">
              پس از صدور پیش‌فاکتورها، نمودار روند فروش در این بخش نمایش داده می‌شود.
            </div>
          ) : (
            <div className="h-52 flex items-end gap-4 pt-6 pb-2 px-2 border-b border-[#D7DEE5]">
              {monthlyChartData.map((d) => {
                const totalHeight = Math.max(8, Math.round((d.total / maxChartAmount) * 100));
                const approvedHeight = d.total > 0 ? Math.round((d.approved / d.total) * 100) : 0;
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div className="text-[11px] text-slate-500 tabular-nums text-center">
                      {formatNumber(d.count)} سند
                    </div>
                    <div
                      className="w-full max-w-[56px] bg-[#172535]/15 rounded-t-md relative overflow-hidden flex items-end transition-all"
                      style={{ height: `${totalHeight}%` }}
                      title={`کل: ${formatCurrency(d.total, currency)} | تاییدشده: ${formatCurrency(d.approved, currency)}`}
                    >
                      <div
                        className="w-full bg-[#347C65] transition-all"
                        style={{ height: `${approvedHeight}%` }}
                      />
                    </div>
                    <div className="text-xs font-medium text-[#172535] tabular-nums">
                      {d.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white border border-[#D7DEE5] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#172535]">توزیع وضعیت پیش‌فاکتورها</h2>
            <p className="text-xs text-slate-500 mt-0.5">نسبت وضعیت‌های ثبت‌شده در سیستم</p>
          </div>

          <div className="space-y-3.5 my-4">
            {(
              [
                { label: 'تاییدشده', count: stats.approvedCount },
                { label: 'ارسال‌شده', count: stats.pendingCount },
                { label: 'پیش‌نویس', count: stats.draftCount },
                { label: 'لغوشده', count: stats.cancelledCount },
                { label: 'منقضی‌شده', count: stats.expiredCount },
              ] as { label: QuotationStatus; count: number }[]
            ).map((row) => {
              const pct =
                stats.totalCount > 0 ? Math.round((row.count / stats.totalCount) * 100) : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${statusMeta[row.label].color}`}>
                      {row.label}
                    </span>
                    <span className="text-slate-600 tabular-nums">
                      {formatNumber(row.count)} ({formatNumber(pct)}٪)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#F1F3F5] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${statusMeta[row.label].bar} rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="inline-flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-[#172535] bg-[#F1F3F5] hover:bg-[#D7DEE5]/60 rounded-lg cursor-pointer"
          >
            <span>مشاهده گزارش‌های تفصیلی</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Latest Quotations & Latest Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D7DEE5] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172535]">آخرین پیش‌فاکتورهای صادرشده</h2>
              <p className="text-xs text-slate-500 mt-0.5">دسترسی سریع به چاپ رسمی PDF</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#172535] hover:text-[#347C65] cursor-pointer whitespace-nowrap"
            >
              <span>آرشیو کامل</span>
              <ArrowUpLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentQuotations.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              هنوز پیش‌فاکتوری صادر نشده است.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F1F3F5]/70 text-slate-500 text-xs border-b border-[#D7DEE5]">
                  <tr>
                    <th className="text-right font-medium px-4 py-3">شماره</th>
                    <th className="text-right font-medium px-4 py-3">مشتری</th>
                    <th className="text-right font-medium px-4 py-3">تاریخ</th>
                    <th className="text-left font-medium px-4 py-3">مبلغ نهایی</th>
                    <th className="text-right font-medium px-4 py-3">وضعیت</th>
                    <th className="text-center font-medium px-4 py-3">مشاهده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentQuotations.map((q) => (
                    <tr key={q.id} className="hover:bg-[#F1F3F5]/40">
                      <td className="px-4 py-3 font-mono-num text-xs font-semibold text-[#172535] whitespace-nowrap">
                        {q.quotationNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#172535] truncate max-w-[180px]">
                          {q.customerCompanyOrProject || q.customerName}
                        </div>
                        {q.customerCompanyOrProject && (
                          <div className="text-xs text-slate-500 truncate max-w-[180px]">
                            {q.customerName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {q.issueDateShamsi}
                      </td>
                      <td className="px-4 py-3 text-left font-semibold text-[#172535] tabular-nums whitespace-nowrap">
                        {formatCurrency(q.grandTotal, q.currency)}
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium whitespace-nowrap ${statusMeta[q.status].color}`}>
                        {q.status}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onPreviewInvoice(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Latest Customers */}
        <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#D7DEE5] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172535]">آخرین مشتریان ثبت‌شده</h2>
              <p className="text-xs text-slate-500 mt-0.5">مجموع {formatNumber(customers.length)} مشتری</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#172535] hover:text-[#347C65] cursor-pointer whitespace-nowrap"
            >
              <span>همه مشتریان</span>
              <ArrowUpLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentCustomers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              هنوز مشتری ثبت نشده است.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 flex-1">
              {recentCustomers.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#172535] truncate">
                      {c.companyOrProject || c.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {c.companyOrProject ? `${c.name} · ` : ''}
                      {c.city || 'بدون شهر'}
                    </div>
                  </div>
                  <div className="text-xs font-mono-num text-slate-600 shrink-0 tabular-nums">
                    {c.mobile}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
