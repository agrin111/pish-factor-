'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Plus, Search, ShieldCheck, UserCog } from 'lucide-react';
import type { Role } from '@prisma/client';
import {
  changePasswordAction,
  createUserAction,
  updateUserAction,
} from '@/actions/users';
import { initialActionState } from '@/lib/forms';
import { Modal } from '@/components/modal';
import { SubmitButton } from '@/components/submit-button';
import { ROLE_LABEL } from '@/lib/labels';
import { formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  lastLoginLabel: string | null;
  quotationCount: number;
  customerCount: number;
}

interface LogRow {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAtLabel: string;
}

export function UsersView({
  users,
  logs,
  currentUserId,
}: {
  users: UserRow[];
  logs: LogRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null);
  const [logQuery, setLogQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('');

  const [createState, createAction] = useActionState(createUserAction, initialActionState);
  const [updateState, updateAction] = useActionState(updateUserAction, initialActionState);
  const [passwordState, passwordAction] = useActionState(changePasswordAction, initialActionState);

  const [dismissedCreate, setDismissedCreate] = useState(initialActionState);
  const [dismissedUpdate, setDismissedUpdate] = useState(initialActionState);
  const [dismissedPassword, setDismissedPassword] = useState(initialActionState);

  const visibleCreateState = createState !== dismissedCreate ? createState : initialActionState;
  const visibleUpdateState = updateState !== dismissedUpdate ? updateState : initialActionState;
  const visiblePasswordState = passwordState !== dismissedPassword ? passwordState : initialActionState;

  const actionTypes = useMemo(() => [...new Set(logs.map((log) => log.action))].sort(), [logs]);
  const filteredLogs = useMemo(() => {
    const term = logQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (logActionFilter && log.action !== logActionFilter) return false;
      if (!term) return true;
      return (
        log.actorName.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.summary.toLowerCase().includes(term)
      );
    });
  }, [logs, logQuery, logActionFilter]);

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false);
      router.refresh();
    }
  }, [createState, router]);

  useEffect(() => {
    if (updateState.ok) {
      setEditing(null);
      router.refresh();
    }
  }, [updateState, router]);

  useEffect(() => {
    if (passwordState.ok) {
      setPasswordFor(null);
      router.refresh();
    }
  }, [passwordState, router]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="کاربران و لاگ فعالیت"
        description="مدیریت دسترسی مدیر سیستم و کارمند فروش؛ همه عملیات مهم در Audit Log ثبت می‌شود."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setDismissedCreate(createState);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            ایجاد کاربر جدید
          </button>
        }
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>نام کاربر</th>
              <th>نام کاربری</th>
              <th>شماره تماس</th>
              <th>نقش</th>
              <th>وضعیت</th>
              <th>پیش‌فاکتورها</th>
              <th>مشتریان</th>
              <th>آخرین ورود</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-semibold">
                  {user.fullName}
                  {user.id === currentUserId && (
                    <span className="badge badge-blue mr-2 !text-[10px]">شما</span>
                  )}
                </td>
                <td dir="ltr" className="text-left text-xs">
                  {user.username}
                </td>
                <td dir="ltr" className="numeric text-left text-xs">
                  {user.phone ?? '—'}
                </td>
                <td>
                  <span className={user.role === 'ADMIN' ? 'badge badge-green' : 'badge badge-gray'}>
                    {ROLE_LABEL[user.role]}
                  </span>
                </td>
                <td>
                  {user.isActive ? (
                    <span className="badge badge-green">فعال</span>
                  ) : (
                    <span className="badge badge-red">غیرفعال</span>
                  )}
                </td>
                <td className="numeric">{formatNumber(user.quotationCount, 0)}</td>
                <td className="numeric">{formatNumber(user.customerCount, 0)}</td>
                <td className="numeric text-xs">{user.lastLoginLabel ?? '—'}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setDismissedUpdate(updateState);
                        setEditing(user);
                      }}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setDismissedPassword(passwordState);
                        setPasswordFor(user);
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      رمز عبور
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent-600" />
            <h2 className="section-title">تاریخچه فعالیت‌ها (Audit Log)</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-400" />
              <input
                value={logQuery}
                onChange={(event) => setLogQuery(event.target.value)}
                className="input !py-1.5 pr-8 text-xs"
                placeholder="جستجو در کاربر یا شرح..."
                aria-label="جستجو در لاگ فعالیت"
              />
            </div>
            <select
              value={logActionFilter}
              onChange={(event) => setLogActionFilter(event.target.value)}
              className="select max-w-[180px] !py-1.5 text-xs"
              aria-label="فیلتر نوع رویداد"
            >
              <option value="">همه رویدادها</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <span className="muted numeric text-[11px]">
              {new Intl.NumberFormat('fa-IR').format(filteredLogs.length)} رکورد
            </span>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="data">
            <thead>
              <tr>
                <th>زمان</th>
                <th>کاربر</th>
                <th>نوع رویداد</th>
                <th>شرح</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted py-8 text-center text-xs">
                    رویدادی مطابق فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="numeric whitespace-nowrap text-xs">{log.createdAtLabel}</td>
                    <td className="text-xs">{log.actorName}</td>
                    <td>
                      <span className="badge badge-gray !text-[10px]" dir="ltr">
                        {log.action}
                      </span>
                    </td>
                    <td className="text-xs">{log.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createOpen} title="ایجاد کاربر جدید" onClose={() => setCreateOpen(false)}>
        <form key={createOpen ? 'create-open' : 'create-closed'} action={createAction} className="space-y-3">
          {visibleCreateState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                visibleCreateState.ok
                  ? 'alert-success'
                  : 'alert-danger'
              }`}
            >
              {visibleCreateState.message}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-fullName">
                نام و نام خانوادگی *
              </label>
              <input id="new-fullName" name="fullName" className="input" required />
              {visibleCreateState.errors?.fullName && (
                <p className="field-error">{visibleCreateState.errors.fullName[0]}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="new-username">
                نام کاربری *
              </label>
              <input id="new-username" name="username" className="input" dir="ltr" required />
              {visibleCreateState.errors?.username && (
                <p className="field-error">{visibleCreateState.errors.username[0]}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="new-password">
                رمز عبور *
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                className="input"
                dir="ltr"
                required
                minLength={8}
              />
              {visibleCreateState.errors?.password && (
                <p className="field-error">{visibleCreateState.errors.password[0]}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="new-role">
                نقش
              </label>
              <select id="new-role" name="role" className="select" defaultValue="SALES">
                <option value="SALES">کارمند فروش</option>
                <option value="ADMIN">مدیر سیستم</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="new-phone">
                شماره تماس
              </label>
              <input id="new-phone" name="phone" className="input" dir="ltr" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              انصراف
            </button>
            <SubmitButton className="btn btn-primary">ایجاد کاربر</SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={editing ? `ویرایش کاربر ${editing.fullName}` : ''}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form key={editing.id} action={updateAction} className="space-y-3">
            <input type="hidden" name="id" value={editing.id} />
            {visibleUpdateState.message && (
              <div
                className={`rounded-lg border p-2.5 text-xs ${
                  visibleUpdateState.ok
                    ? 'alert-success'
                    : 'alert-danger'
                }`}
              >
                {visibleUpdateState.message}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="edit-fullName">
                  نام و نام خانوادگی
                </label>
                <input
                  id="edit-fullName"
                  name="fullName"
                  className="input"
                  defaultValue={editing.fullName}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-role">
                  نقش
                </label>
                <select id="edit-role" name="role" className="select" defaultValue={editing.role}>
                  <option value="SALES">کارمند فروش</option>
                  <option value="ADMIN">مدیر سیستم</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="edit-phone">
                  شماره تماس
                </label>
                <input
                  id="edit-phone"
                  name="phone"
                  className="input"
                  dir="ltr"
                  defaultValue={editing.phone ?? ''}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={editing.isActive}
                className="h-4 w-4"
              />
              حساب کاربری فعال باشد
            </label>
            <p className="field-hint">
              برای غیرفعال‌کردن، تیک را بردارید؛ در این حالت همه نشست‌های کاربر باطل می‌شود.
            </p>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
                انصراف
              </button>
              <SubmitButton className="btn btn-primary">ذخیره تغییرات</SubmitButton>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(passwordFor)}
        title={passwordFor ? `تغییر رمز عبور ${passwordFor.fullName}` : ''}
        onClose={() => setPasswordFor(null)}
      >
        {passwordFor && (
          <form key={passwordFor.id} action={passwordAction} className="space-y-3">
            <input type="hidden" name="id" value={passwordFor.id} />
            {visiblePasswordState.message && (
              <div
                className={`rounded-lg border p-2.5 text-xs ${
                  visiblePasswordState.ok
                    ? 'alert-success'
                    : 'alert-danger'
                }`}
              >
                {visiblePasswordState.message}
              </div>
            )}
            <div>
              <label className="label" htmlFor="pw-password">
                رمز عبور جدید *
              </label>
              <input
                id="pw-password"
                name="password"
                type="password"
                className="input"
                dir="ltr"
                minLength={8}
                required
              />
              {visiblePasswordState.errors?.password && (
                <p className="field-error">{visiblePasswordState.errors.password[0]}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="pw-confirm">
                تکرار رمز عبور *
              </label>
              <input
                id="pw-confirm"
                name="confirm"
                type="password"
                className="input"
                dir="ltr"
                minLength={8}
                required
              />
              {visiblePasswordState.errors?.confirm && (
                <p className="field-error">{visiblePasswordState.errors.confirm[0]}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <button type="button" className="btn btn-secondary" onClick={() => setPasswordFor(null)}>
                انصراف
              </button>
              <SubmitButton className="btn btn-primary">تغییر رمز</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
