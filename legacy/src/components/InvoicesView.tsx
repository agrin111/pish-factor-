import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Copy,
  Trash2,
  History,
  FileText,
  X,
} from 'lucide-react';
import {
  Quotation,
  QuotationStatus,
  QuotationStatusHistory,
  UserProfile,
} from '../types';
import { fetchQuotationStatusHistory } from '../services/firestoreService';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface InvoicesViewProps {
  quotations: Quotation[];
  currentUser: UserProfile;
  onCreateInvoice: () => void;
  onEditInvoice: (quotation: Quotation) => void;
  onPreviewInvoice: (quotation: Quotation) => void;
  onDuplicateInvoice: (quotation: Quotation) => void;
  onUpdateStatus: (quotation: Quotation, status: QuotationStatus) => Promise<void>;
  onDeleteInvoice: (quotation: Quotation) => Promise<void>;
}

const statusFilters: ('همه' | QuotationStatus)[] = [
  'همه',
  'پیش‌نویس',
  'ارسال‌شده',
  'تاییدشده',
  'لغوشده',
  'منقضی‌شده',
];

const statusTextClass: Record<QuotationStatus, string> = {
  'تاییدشده': 'text-[#347C65]',
  'ارسال‌شده': 'text-amber-700',
  'پیش‌نویس': 'text-slate-600',
  'لغوشده': 'text-rose-700',
  'منقضی‌شده': 'text-slate-500',
};

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  quotations,
  currentUser,
  onCreateInvoice,
  onEditInvoice,
  onPreviewInvoice,
  onDuplicateInvoice,
  onUpdateStatus,
  onDeleteInvoice,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'همه' | QuotationStatus>('همه');
  const [issuerFilter, setIssuerFilter] = useState('همه');
  const [dateFilter, setDateFilter] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // History modal
  const [historyModalQuotation, setHistoryModalQuotation] = useState<Quotation | null>(null);
  const [historyList, setHistoryList] = useState<QuotationStatusHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const issuers = useMemo(() => {
    const names = new Set<string>();
    quotations.forEach((q) => {
      if (q.createdByName) names.add(q.createdByName);
    });
    return ['همه', ...Array.from(names)];
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const df = dateFilter.trim();
    return quotations.filter((item) => {
      if (statusFilter !== 'همه' && item.status !== statusFilter) return false;
      if (issuerFilter !== 'همه' && item.createdByName !== issuerFilter) return false;
      if (df && !item.issueDateShamsi.includes(df)) return false;
      if (!q) return true;
      return [
        item.quotationNumber,
        item.customerName,
        item.customerMobile || '',
        item.customerCompanyOrProject || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [quotations, searchQuery, statusFilter, issuerFilter, dateFilter]);

  const openHistory = async (quotation: Quotation) => {
    setHistoryModalQuotation(quotation);
    setHistoryLoading(true);
    try {
      const rows = await fetchQuotationStatusHistory(quotation.id);
      setHistoryList(rows);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172535]">آرشیو و مدیریت پیش‌فاکتورها</h1>
          <p className="text-sm text-slate-500 mt-1">
            جستجو بر اساس شماره پیش‌فاکتور، نام مشتری، تاریخ، وضعیت و مشاهده تاریخچه تغییرات
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

      {/* Filters */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با شماره پیش‌فاکتور، نام مشتری یا موبایل..."
              className="w-full pr-9 pl-3 py-2 text-sm border border-[#D7DEE5] rounded-lg focus:outline-none focus:border-[#172535]"
            />
          </div>

          <input
            type="text"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="فیلتر تاریخ صدور (مثلاً ۱۴۰۵/۰۸)..."
            className="px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg focus:outline-none focus:border-[#172535]"
          />

          {isAdmin && (
            <select
              value={issuerFilter}
              onChange={(e) => setIssuerFilter(e.target.value)}
              aria-label="فیلتر صادرکننده"
              className="px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg bg-white focus:outline-none focus:border-[#172535]"
            >
              {issuers.map((name) => (
                <option key={name} value={name}>
                  صادرکننده: {name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F1F3F5] rounded-lg overflow-x-auto">
          {statusFilters.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-[#172535] shadow-sm'
                  : 'text-slate-600 hover:text-[#172535]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
        {filteredQuotations.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="mt-3 text-sm font-medium text-[#172535]">
              پیش‌فاکتوری با این مشخصات یافت نشد
            </div>
            <button
              type="button"
              onClick={onCreateInvoice}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#347C65] hover:bg-[#2c6a56] text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>صدور پیش‌فاکتور جدید</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F1F3F5]/80 text-slate-500 text-xs border-b border-[#D7DEE5]">
                <tr>
                  <th className="text-right font-medium px-4 py-3">شماره پیش‌فاکتور</th>
                  <th className="text-right font-medium px-4 py-3">خریدار / پروژه</th>
                  <th className="text-right font-medium px-4 py-3">تاریخ / اعتبار</th>
                  <th className="text-right font-medium px-4 py-3">صادرکننده</th>
                  <th className="text-left font-medium px-4 py-3">مبلغ نهایی</th>
                  <th className="text-right font-medium px-4 py-3">وضعیت</th>
                  <th className="text-center font-medium px-4 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((q) => {
                  const isTerminal = q.status === 'تاییدشده' || q.status === 'لغوشده';
                  const canEdit = isAdmin || (!isTerminal && q.createdByUid === currentUser.uid);

                  return (
                    <tr key={q.id} className="hover:bg-[#F1F3F5]/40 transition-colors">
                      <td className="px-4 py-3.5 font-mono-num text-xs font-semibold text-[#172535] whitespace-nowrap">
                        {q.quotationNumber}
                        <div className="text-[11px] font-sans font-normal text-slate-400 mt-0.5">
                          {formatNumber(q.itemCount)} ردیف · {formatNumber(q.totalWeightKg)} ک‌گ
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[#172535]">
                          {q.customerCompanyOrProject || q.customerName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {q.customerCompanyOrProject ? `${q.customerName} · ` : ''}
                          {q.customerMobile || ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        <div>صدور: {q.issueDateShamsi}</div>
                        <div className="text-slate-400 mt-0.5">اعتبار: {q.validUntilShamsi}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                        {q.createdByName}
                      </td>
                      <td className="px-4 py-3.5 text-left font-semibold text-[#172535] tabular-nums whitespace-nowrap">
                        {formatCurrency(q.grandTotal, q.currency)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <select
                          aria-label="تغییر وضعیت"
                          disabled={!canEdit}
                          value={q.status}
                          onChange={(e) =>
                            void onUpdateStatus(q, e.target.value as QuotationStatus)
                          }
                          className={`text-xs font-medium bg-white border border-[#D7DEE5] rounded-md px-2 py-1 focus:outline-none disabled:opacity-60 cursor-pointer ${statusTextClass[q.status]}`}
                        >
                          <option value="پیش‌نویس">پیش‌نویس</option>
                          <option value="ارسال‌شده">ارسال‌شده</option>
                          <option value="تاییدشده">تاییدشده</option>
                          <option value="لغوشده">لغوشده</option>
                          <option value="منقضی‌شده">منقضی‌شده</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        {confirmDeleteId === q.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                void onDeleteInvoice(q);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 text-xs font-medium bg-rose-600 text-white rounded-md cursor-pointer"
                            >
                              تایید حذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              لغو
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onPreviewInvoice(q)}
                              title="پیش‌نمایش و دریافت PDF رسمی"
                              className="p-1.5 text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onEditInvoice(q)}
                                title="ویرایش"
                                className="p-1.5 text-slate-600 hover:text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDuplicateInvoice(q)}
                              title="کپی پیش‌فاکتور"
                              className="p-1.5 text-slate-600 hover:text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void openHistory(q)}
                              title="تاریخچه وضعیت"
                              className="p-1.5 text-slate-600 hover:text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(q.id)}
                                title="حذف پیش‌فاکتور"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status History Modal */}
      {historyModalQuotation && (
        <div className="fixed inset-0 z-50 bg-[#172535]/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7DEE5] rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D7DEE5] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#172535]">
                  تاریخچه تغییر وضعیت — {historyModalQuotation.quotationNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalQuotation(null)}
                className="p-1.5 text-slate-400 hover:text-[#172535] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto">
              {historyLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">در حال بارگذاری...</div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">سابقه‌ای ثبت نشده است.</div>
              ) : (
                <div className="space-y-3">
                  {historyList.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg border border-[#D7DEE5] bg-[#F1F3F5]/40 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-medium text-[#172535]">
                        <span>
                          {h.fromStatus} ← {h.toStatus}
                        </span>
                        <span className="text-slate-500">{h.changedByName}</span>
                      </div>
                      {h.note && <div className="text-slate-600">{h.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
