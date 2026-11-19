import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { CurrencyType, Quotation } from '../types';
import { exportToCsv, formatCurrency, formatNumber } from '../utils/formatters';

interface ReportsViewProps {
  quotations: Quotation[];
  currency: CurrencyType;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ quotations, currency }) => {
  const [datePrefix, setDatePrefix] = useState('');

  const filtered = useMemo(() => {
    const df = datePrefix.trim();
    if (!df) return quotations;
    return quotations.filter((q) => q.issueDateShamsi.includes(df));
  }, [quotations, datePrefix]);

  const summary = useMemo(() => {
    const totalCount = filtered.length;
    const approved = filtered.filter((q) => q.status === 'تاییدشده');
    const cancelled = filtered.filter((q) => q.status === 'لغوشده');
    const pending = filtered.filter((q) => q.status === 'ارسال‌شده');
    const totalAmount = filtered
      .filter((q) => q.status !== 'لغوشده')
      .reduce((acc, q) => acc + (q.grandTotal || 0), 0);
    const approvedAmount = approved.reduce((acc, q) => acc + (q.grandTotal || 0), 0);

    return {
      totalCount,
      approvedCount: approved.length,
      cancelledCount: cancelled.length,
      pendingCount: pending.length,
      totalAmount,
      approvedAmount,
    };
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; count: number; approved: number; total: number }>();
    for (const q of filtered) {
      const parts = (q.issueDateShamsi || '').split('/');
      const key = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : 'نامشخص';
      const cur = map.get(key) || { month: key, count: 0, approved: 0, total: 0 };
      cur.count += 1;
      if (q.status === 'تاییدشده') cur.approved += 1;
      if (q.status !== 'لغوشده') cur.total += q.grandTotal || 0;
      map.set(key, cur);
    }
    return Array.from(map.values());
  }, [filtered]);

  const byCustomer = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number; approvedTotal: number }>();
    for (const q of filtered) {
      const key = q.customerId;
      const cur = map.get(key) || {
        name: q.customerCompanyOrProject || q.customerName,
        count: 0,
        total: 0,
        approvedTotal: 0,
      };
      cur.count += 1;
      if (q.status !== 'لغوشده') cur.total += q.grandTotal || 0;
      if (q.status === 'تاییدشده') cur.approvedTotal += q.grandTotal || 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byUser = useMemo(() => {
    const map = new Map<string, { name: string; count: number; approved: number; total: number }>();
    for (const q of filtered) {
      const key = q.createdByUid;
      const cur = map.get(key) || { name: q.createdByName, count: 0, approved: 0, total: 0 };
      cur.count += 1;
      if (q.status === 'تاییدشده') cur.approved += 1;
      if (q.status !== 'لغوشده') cur.total += q.grandTotal || 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const handleExportCsv = () => {
    exportToCsv(
      `aghrin-sales-report.csv`,
      [
        'شماره پیش‌فاکتور',
        'تاریخ صدور',
        'تاریخ اعتبار',
        'نام مشتری',
        'شرکت / پروژه',
        'صادرکننده',
        'وضعیت',
        'جمع کالاها',
        'حمل',
        'مالیات',
        'تخفیف',
        'مبلغ نهایی',
        'واحد پول',
      ],
      filtered.map((q) => [
        q.quotationNumber,
        q.issueDateShamsi,
        q.validUntilShamsi,
        q.customerName,
        q.customerCompanyOrProject || '',
        q.createdByName,
        q.status,
        q.itemsSubtotal,
        q.transportCost,
        q.vatAmount,
        q.discountAmount,
        q.grandTotal,
        q.currency,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172535]">گزارش‌های فروش و عملکرد</h1>
          <p className="text-sm text-slate-500 mt-1">
            تحلیل دوره‌ای پیش‌فاکتورها، عملکرد مشتریان، کارشناسان فروش و دریافت خروجی اکسل (CSV)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={datePrefix}
            onChange={(e) => setDatePrefix(e.target.value)}
            placeholder="فیلتر تاریخ (مثلاً ۱۴۰۵/۰۸)"
            className="px-3 py-2 text-sm bg-white border border-[#D7DEE5] rounded-lg"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#347C65] hover:bg-[#2c6a56] text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>خروجی Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D7DEE5] rounded-xl p-4">
          <div className="text-xs text-slate-500">تعداد کل پیش‌فاکتورها</div>
          <div className="mt-2 text-xl font-bold text-[#172535] tabular-nums">
            {formatNumber(summary.totalCount)}
          </div>
        </div>
        <div className="bg-white border border-[#D7DEE5] rounded-xl p-4">
          <div className="text-xs text-slate-500">تأییدشده / لغوشده</div>
          <div className="mt-2 text-xl font-bold text-[#347C65] tabular-nums">
            {formatNumber(summary.approvedCount)} /{' '}
            <span className="text-rose-600">{formatNumber(summary.cancelledCount)}</span>
          </div>
        </div>
        <div className="bg-white border border-[#D7DEE5] rounded-xl p-4">
          <div className="text-xs text-slate-500">مجموع مبالغ پیش‌فاکتورها</div>
          <div className="mt-2 text-lg font-bold text-[#172535] tabular-nums">
            {formatCurrency(summary.totalAmount, currency)}
          </div>
        </div>
        <div className="bg-white border border-[#D7DEE5] rounded-xl p-4">
          <div className="text-xs text-slate-500">فروش قطعی (تأییدشده)</div>
          <div className="mt-2 text-lg font-bold text-[#347C65] tabular-nums">
            {formatCurrency(summary.approvedAmount, currency)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly */}
        <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D7DEE5] font-bold text-sm text-[#172535]">
            گزارش ماهانه پیش‌فاکتورها
          </div>
          <table className="w-full text-xs">
            <thead className="bg-[#F1F3F5] text-slate-500 border-b border-[#D7DEE5]">
              <tr>
                <th className="text-right font-medium px-4 py-2.5">ماه</th>
                <th className="text-center font-medium px-4 py-2.5">تعداد</th>
                <th className="text-center font-medium px-4 py-2.5">تأییدشده</th>
                <th className="text-left font-medium px-4 py-2.5">مجموع مبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byMonth.map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-3 font-medium tabular-nums">{m.month}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatNumber(m.count)}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-[#347C65]">
                    {formatNumber(m.approved)}
                  </td>
                  <td className="px-4 py-3 text-left font-semibold tabular-nums">
                    {formatCurrency(m.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By Sales Rep */}
        <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D7DEE5] font-bold text-sm text-[#172535]">
            گزارش عملکرد کاربران صادرکننده
          </div>
          <table className="w-full text-xs">
            <thead className="bg-[#F1F3F5] text-slate-500 border-b border-[#D7DEE5]">
              <tr>
                <th className="text-right font-medium px-4 py-2.5">کاربر</th>
                <th className="text-center font-medium px-4 py-2.5">تعداد کل</th>
                <th className="text-center font-medium px-4 py-2.5">تأییدشده</th>
                <th className="text-left font-medium px-4 py-2.5">مجموع مبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byUser.map((u) => (
                <tr key={u.name}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatNumber(u.count)}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-[#347C65]">
                    {formatNumber(u.approved)}
                  </td>
                  <td className="px-4 py-3 text-left font-semibold tabular-nums">
                    {formatCurrency(u.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Customer */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D7DEE5] font-bold text-sm text-[#172535]">
          گزارش مشتریان بر اساس ارزش پیش‌فاکتورها
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F1F3F5] text-slate-500 border-b border-[#D7DEE5]">
              <tr>
                <th className="text-right font-medium px-4 py-2.5">مشتری / شرکت</th>
                <th className="text-center font-medium px-4 py-2.5">تعداد پیش‌فاکتور</th>
                <th className="text-left font-medium px-4 py-2.5">مبلغ کل صادره</th>
                <th className="text-left font-medium px-4 py-2.5">مبلغ تأییدشده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byCustomer.map((c) => (
                <tr key={c.name}>
                  <td className="px-4 py-3 font-medium text-[#172535]">{c.name}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatNumber(c.count)}</td>
                  <td className="px-4 py-3 text-left tabular-nums">
                    {formatCurrency(c.total, currency)}
                  </td>
                  <td className="px-4 py-3 text-left font-semibold text-[#347C65] tabular-nums">
                    {formatCurrency(c.approvedTotal, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
