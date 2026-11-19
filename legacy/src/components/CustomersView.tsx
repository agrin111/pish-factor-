import React, { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Users, X, Save, Eye } from 'lucide-react';
import { CurrencyType, Customer, CustomerType, Quotation, UserProfile } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface CustomersViewProps {
  customers: Customer[];
  quotations: Quotation[];
  currency: CurrencyType;
  currentUser: UserProfile;
  onSaveCustomer: (
    customer: Omit<Customer, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteCustomer: (customer: Customer) => Promise<{ ok: boolean; reason?: string }>;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  quotations,
  currency,
  currentUser,
  onSaveCustomer,
  onDeleteCustomer,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'همه' | CustomerType>('همه');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Form states
  const [customerType, setCustomerType] = useState<CustomerType>('حقوقی');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [companyOrProject, setCompanyOrProject] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const customerStats = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number }>();
    for (const q of quotations) {
      if (q.status === 'لغوشده') continue;
      const cur = map.get(q.customerId) || { count: 0, totalAmount: 0 };
      cur.count += 1;
      cur.totalAmount += q.grandTotal || 0;
      map.set(q.customerId, cur);
    }
    return map;
  }, [quotations]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (typeFilter !== 'همه' && c.customerType !== typeFilter) return false;
      if (!q) return true;
      return [c.name, c.mobile, c.secondaryPhone || '', c.companyOrProject || '', c.city || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [customers, searchQuery, typeFilter]);

  const openNewModal = () => {
    setEditingCustomer(null);
    setCustomerType('حقوقی');
    setName('');
    setMobile('');
    setSecondaryPhone('');
    setCompanyOrProject('');
    setNationalId('');
    setEconomicCode('');
    setCity('');
    setAddress('');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerType(customer.customerType);
    setName(customer.name);
    setMobile(customer.mobile);
    setSecondaryPhone(customer.secondaryPhone || '');
    setCompanyOrProject(customer.companyOrProject || '');
    setNationalId(customer.nationalId || '');
    setEconomicCode(customer.economicCode || '');
    setCity(customer.city || '');
    setAddress(customer.address || '');
    setNotes(customer.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      setFormError('نام مشتری و شماره موبایل الزامی است.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await onSaveCustomer({
        id: editingCustomer?.id,
        customerType,
        name: name.trim(),
        mobile: mobile.trim(),
        secondaryPhone: secondaryPhone.trim(),
        companyOrProject: companyOrProject.trim(),
        nationalId: nationalId.trim(),
        economicCode: economicCode.trim(),
        city: city.trim(),
        address: address.trim(),
        notes: notes.trim(),
      });
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'خطا در ذخیره مشتری');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (customer: Customer) => {
    setDeleteError('');
    const result = await onDeleteCustomer(customer);
    if (!result.ok && result.reason) {
      setDeleteError(result.reason);
    }
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172535]">مدیریت مشتریان و پروژه‌ها</h1>
          <p className="text-sm text-slate-500 mt-1">
            جستجو بر اساس نام یا شماره موبایل، مشاهده سوابق و کنترل وابستگی پیش‌فاکتورها هنگام حذف
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#347C65] hover:bg-[#2c6a56] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت مشتری جدید</span>
        </button>
      </div>

      {deleteError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError('')}
            className="text-xs font-semibold underline cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو با نام مشتری، شماره موبایل یا شرکت/پروژه..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-[#D7DEE5] rounded-lg focus:outline-none focus:border-[#172535]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F1F3F5] rounded-lg">
          {(['همه', 'حقوقی', 'حقیقی'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === t
                  ? 'bg-white text-[#172535] shadow-sm'
                  : 'text-slate-600 hover:text-[#172535]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="mt-3 text-sm font-medium text-[#172535]">مشتری یافت نشد</div>
            <button
              type="button"
              onClick={openNewModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#347C65] text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت اولین مشتری</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F1F3F5]/80 text-slate-500 text-xs border-b border-[#D7DEE5]">
                <tr>
                  <th className="text-right font-medium px-4 py-3">نام شخص / شرکت</th>
                  <th className="text-right font-medium px-4 py-3">شماره تماس</th>
                  <th className="text-right font-medium px-4 py-3">شهر و نشانی</th>
                  <th className="text-left font-medium px-4 py-3">حجم پیش‌فاکتورها</th>
                  <th className="text-center font-medium px-4 py-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => {
                  const stat = customerStats.get(customer.id) || { count: 0, totalAmount: 0 };
                  const canModify = isAdmin || customer.createdByUid === currentUser.uid;
                  return (
                    <tr key={customer.id} className="hover:bg-[#F1F3F5]/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#172535]">
                          {customer.companyOrProject || customer.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {customer.companyOrProject ? `${customer.name} · ` : ''}
                          {customer.customerType}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        <div className="font-mono-num font-medium text-[#172535]">
                          {customer.mobile}
                        </div>
                        {customer.secondaryPhone && (
                          <div className="font-mono-num text-slate-400 mt-0.5">
                            {customer.secondaryPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <div className="truncate max-w-[260px]">
                          {[customer.city, customer.address].filter(Boolean).join(' — ') || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-left tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-[#172535]">
                          {formatCurrency(stat.totalAmount, currency)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatNumber(stat.count)} پیش‌فاکتور
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {confirmDeleteId === customer.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleConfirmDelete(customer)}
                              className="px-2.5 py-1 text-xs font-medium bg-rose-600 text-white rounded-md cursor-pointer"
                            >
                              حذف
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
                              onClick={() => setDetailCustomer(customer)}
                              className="p-1.5 text-slate-600 hover:text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                              title="مشاهده جزئیات"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => openEditModal(customer)}
                                className="p-1.5 text-slate-600 hover:text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                                title="ویرایش"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(customer.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                                title="حذف مشتری"
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#172535]/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#D7DEE5] rounded-xl w-full max-w-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#172535] text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingCustomer ? 'ویرایش مشخصات مشتری' : 'ثبت مشتری جدید'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div className="flex gap-2 p-1 bg-[#F1F3F5] rounded-lg w-fit">
                {(['حقوقی', 'حقیقی'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCustomerType(t)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      customerType === t ? 'bg-white text-[#172535] shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    شخص {t}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    نام شخص یا رابط *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    نام شرکت یا پروژه
                  </label>
                  <input
                    type="text"
                    value={companyOrProject}
                    onChange={(e) => setCompanyOrProject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    شماره موبایل *
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-sm font-mono-num border border-[#D7DEE5] rounded-lg text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    شماره تماس دوم
                  </label>
                  <input
                    type="text"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-sm font-mono-num border border-[#D7DEE5] rounded-lg text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    {customerType === 'حقوقی' ? 'شناسه ملی' : 'کد ملی'}
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    کد اقتصادی / شهر
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={economicCode}
                      onChange={(e) => setEconomicCode(e.target.value)}
                      placeholder="کد اقتصادی"
                      className="w-1/2 px-2.5 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
                    />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="شهر"
                      className="w-1/2 px-2.5 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#172535] mb-1">آدرس کامل</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#172535] mb-1">توضیحات</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#D7DEE5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#347C65] hover:bg-[#2c6a56] text-white rounded-lg cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'در حال ذخیره...' : 'ذخیره مشتری'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 z-50 bg-[#172535]/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7DEE5] rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-5 py-4 bg-[#172535] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">پرونده مشتری — {detailCustomer.name}</h3>
              <button
                type="button"
                onClick={() => setDetailCustomer(null)}
                className="p-1 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              <div><span className="text-slate-500">شرکت / پروژه: </span>{detailCustomer.companyOrProject || '—'}</div>
              <div><span className="text-slate-500">موبایل: </span><span className="font-mono-num">{detailCustomer.mobile}</span></div>
              <div><span className="text-slate-500">تماس دوم: </span><span className="font-mono-num">{detailCustomer.secondaryPhone || '—'}</span></div>
              <div><span className="text-slate-500">شناسه/کد ملی: </span>{detailCustomer.nationalId || '—'}</div>
              <div><span className="text-slate-500">کد اقتصادی: </span>{detailCustomer.economicCode || '—'}</div>
              <div><span className="text-slate-500">آدرس: </span>{[detailCustomer.city, detailCustomer.address].filter(Boolean).join('، ') || '—'}</div>
              <div><span className="text-slate-500">توضیحات: </span>{detailCustomer.notes || '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
