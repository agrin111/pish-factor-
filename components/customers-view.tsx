'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { deleteCustomerAction, saveCustomerAction } from '@/actions/customers';
import { initialActionState } from '@/lib/forms';
import { Modal } from '@/components/modal';
import { SubmitButton } from '@/components/submit-button';
import { CUSTOMER_TYPE_LABEL } from '@/lib/labels';

export interface CustomerRow {
  id: string;
  name: string;
  mobile: string;
  secondaryPhone: string | null;
  companyOrProject: string | null;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  nationalId: string | null;
  economicCode: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  createdAtLabel: string;
  quotationCount: number;
}

interface Props {
  customers: CustomerRow[];
  isAdmin: boolean;
}

export function CustomersView({ customers, isAdmin }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INDIVIDUAL' | 'COMPANY'>('ALL');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [state, formAction] = useActionState(saveCustomerAction, initialActionState);
  const [deleteState, deleteAction] = useActionState(deleteCustomerAction, initialActionState);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dismissedSave, setDismissedSave] = useState(initialActionState);
  const [dismissedDelete, setDismissedDelete] = useState(initialActionState);

  const visibleSaveState = state !== dismissedSave ? state : initialActionState;
  const visibleDeleteState = deleteState !== dismissedDelete ? deleteState : initialActionState;

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setEditing(null);
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (deleteState.ok) {
      setConfirmId(null);
      router.refresh();
    }
  }, [deleteState, router]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (typeFilter !== 'ALL' && customer.customerType !== typeFilter) return false;
      if (!term) return true;
      return [
        customer.name,
        customer.mobile,
        customer.secondaryPhone,
        customer.companyOrProject,
        customer.nationalId,
        customer.economicCode,
        customer.city,
        customer.address,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [customers, query, typeFilter]);

  const openCreate = () => {
    setDismissedSave(state);
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (customer: CustomerRow) => {
    setDismissedSave(state);
    setEditing(customer);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">مدیریت مشتریان</h1>
          <p className="muted mt-1 text-xs">
            ثبت و نگهداری اطلاعات مشتریان حقیقی و حقوقی — جستجو بر اساس نام، موبایل و شرکت
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary">
          <Plus className="h-4 w-4" />
          ثبت مشتری جدید
        </button>
      </div>

      <div className="card card-pad flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input pr-9"
            placeholder="جستجوی نام، موبایل، شرکت، کد/شناسه ملی، کد اقتصادی یا شهر..."
            aria-label="جستجوی مشتری"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'ALL' | 'INDIVIDUAL' | 'COMPANY')}
          className="select max-w-[160px]"
          aria-label="فیلتر نوع مشتری"
        >
          <option value="ALL">همه مشتریان</option>
          <option value="INDIVIDUAL">حقیقی</option>
          <option value="COMPANY">حقوقی</option>
        </select>
        <span className="muted text-xs">
          {new Intl.NumberFormat('fa-IR').format(filtered.length)} مشتری
        </span>
        {deleteState.message && !deleteState.ok && (
          <span className="text-xs text-rose-700">{deleteState.message}</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D7DEE5] bg-white p-10 text-center">
          <UserRound className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold">مشتری‌ای یافت نشد</p>
          <p className="muted mt-1 text-xs">
            {customers.length === 0
              ? 'برای شروع، اولین مشتری را ثبت کنید.'
              : 'عبارت جستجو را تغییر دهید.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>نام مشتری</th>
                <th>موبایل / تماس</th>
                <th>شرکت / پروژه</th>
                <th>شناسه / کد اقتصادی</th>
                <th>نوع</th>
                <th>شهر</th>
                <th>پیش‌فاکتورها</th>
                <th>تاریخ ثبت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-semibold">
                    {customer.name}
                    {customer.address && (
                      <div className="muted mt-0.5 max-w-[220px] truncate text-[11px] font-normal">
                        {customer.address}
                      </div>
                    )}
                  </td>
                  <td className="numeric" dir="ltr">
                    <div>{customer.mobile}</div>
                    {customer.secondaryPhone && (
                      <div className="muted mt-0.5 text-[11px]">{customer.secondaryPhone}</div>
                    )}
                  </td>
                  <td>{customer.companyOrProject ?? '—'}</td>
                  <td className="numeric text-xs">
                    {customer.nationalId || customer.economicCode ? (
                      <div className="space-y-0.5">
                        {customer.nationalId && <div>ملی: {customer.nationalId}</div>}
                        {customer.economicCode && (
                          <div className="muted text-[11px]">اقتصادی: {customer.economicCode}</div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span className="badge badge-gray">
                      {CUSTOMER_TYPE_LABEL[customer.customerType]}
                    </span>
                  </td>
                  <td>{customer.city ?? '—'}</td>
                  <td className="numeric">{customer.quotationCount}</td>
                  <td className="numeric">{customer.createdAtLabel}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() => openEdit(customer)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        ویرایش
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setDismissedDelete(deleteState);
                            setConfirmId(customer.id);
                          }}
                          className="btn btn-danger btn-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title={editing ? `ویرایش مشتری ${editing.name}` : 'ثبت مشتری جدید'}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <form key={editing?.id ?? 'new'} action={formAction} className="space-y-3">
          {editing && <input type="hidden" name="id" value={editing.id} />}

          {visibleSaveState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                visibleSaveState.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {visibleSaveState.message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                نام شخص یا شرکت *
              </label>
              <input
                id="name"
                name="name"
                className="input"
                defaultValue={editing?.name ?? ''}
                required
                aria-invalid={Boolean(visibleSaveState.errors?.name)}
              />
              {visibleSaveState.errors?.name && (
                <p className="field-error">{visibleSaveState.errors.name[0]}</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="mobile">
                شماره موبایل *
              </label>
              <input
                id="mobile"
                name="mobile"
                className="input"
                dir="ltr"
                inputMode="tel"
                defaultValue={editing?.mobile ?? ''}
                required
                aria-invalid={Boolean(visibleSaveState.errors?.mobile)}
              />
              {visibleSaveState.errors?.mobile && (
                <p className="field-error">{visibleSaveState.errors.mobile[0]}</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="secondaryPhone">
                شماره تماس دوم
              </label>
              <input
                id="secondaryPhone"
                name="secondaryPhone"
                className="input"
                dir="ltr"
                defaultValue={editing?.secondaryPhone ?? ''}
              />
            </div>

            <div>
              <label className="label" htmlFor="customerType">
                نوع مشتری
              </label>
              <select
                id="customerType"
                name="customerType"
                className="select"
                defaultValue={editing?.customerType ?? 'INDIVIDUAL'}
              >
                <option value="INDIVIDUAL">حقیقی</option>
                <option value="COMPANY">حقوقی</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="companyOrProject">
                نام شرکت یا پروژه
              </label>
              <input
                id="companyOrProject"
                name="companyOrProject"
                className="input"
                defaultValue={editing?.companyOrProject ?? ''}
              />
            </div>

            <div>
              <label className="label" htmlFor="city">
                شهر
              </label>
              <input id="city" name="city" className="input" defaultValue={editing?.city ?? ''} />
            </div>

            <div>
              <label className="label" htmlFor="nationalId">
                شناسه ملی / کد ملی
              </label>
              <input
                id="nationalId"
                name="nationalId"
                className="input numeric"
                dir="ltr"
                defaultValue={editing?.nationalId ?? ''}
              />
            </div>

            <div>
              <label className="label" htmlFor="economicCode">
                کد اقتصادی
              </label>
              <input
                id="economicCode"
                name="economicCode"
                className="input numeric"
                dir="ltr"
                defaultValue={editing?.economicCode ?? ''}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="address">
              نشانی
            </label>
            <textarea
              id="address"
              name="address"
              className="textarea"
              rows={2}
              defaultValue={editing?.address ?? ''}
            />
          </div>

          <div>
            <label className="label" htmlFor="notes">
              توضیحات
            </label>
            <textarea
              id="notes"
              name="notes"
              className="textarea"
              rows={2}
              defaultValue={editing?.notes ?? ''}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[#D7DEE5] pt-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              انصراف
            </button>
            <SubmitButton className="btn btn-primary">
              {editing ? 'ذخیره تغییرات' : 'ثبت مشتری'}
            </SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(confirmId)} title="حذف مشتری" onClose={() => setConfirmId(null)}>
        <form action={deleteAction} className="space-y-4">
          <input type="hidden" name="id" value={confirmId ?? ''} />
          {visibleDeleteState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                visibleDeleteState.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {visibleDeleteState.message}
            </div>
          )}
          <p className="text-sm leading-relaxed">
            آیا از حذف این مشتری اطمینان دارید؟ مشتریانی که پیش‌فاکتور دارند حذف نمی‌شوند و باید
            اطلاعاتشان ویرایش شود.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmId(null)}>
              انصراف
            </button>
            <SubmitButton className="btn btn-danger">حذف مشتری</SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
