'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Plus, ShieldCheck, UserCog } from 'lucide-react';
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

  const [createState, createAction] = useActionState(createUserAction, initialActionState);
  const [updateState, updateAction] = useActionState(updateUserAction, initialActionState);
  const [passwordState, passwordAction] = useActionState(changePasswordAction, initialActionState);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">کاربران و لاگ فعالیت</h1>
          <p className="muted mt-1 text-xs">
            مدیریت دسترسی مدیر سیستم و کارمند فروش؛ همه عملیات مهم در Audit Log ثبت می‌شود.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          ایجاد کاربر جدید
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>نام کاربر</th>
              <th>نام کاربری</th>
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
                <td className="numeric">{user.quotationCount}</td>
                <td className="numeric">{user.customerCount}</td>
                <td className="numeric text-xs">{user.lastLoginLabel ?? '—'}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditing(user)}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPasswordFor(user)}
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
        <div className="flex items-center gap-2 border-b border-[#D7DEE5] px-5 py-3.5">
          <ShieldCheck className="h-4 w-4 text-[#347C65]" />
          <h2 className="section-title">تاریخچه فعالیت‌ها (Audit Log)</h2>
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
              {logs.map((log) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createOpen} title="ایجاد کاربر جدید" onClose={() => setCreateOpen(false)}>
        <form action={createAction} className="space-y-3">
          {createState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                createState.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {createState.message}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-fullName">
                نام و نام خانوادگی *
              </label>
              <input id="new-fullName" name="fullName" className="input" required />
              {createState.errors?.fullName && (
                <p className="field-error">{createState.errors.fullName[0]}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="new-username">
                نام کاربری *
              </label>
              <input id="new-username" name="username" className="input" dir="ltr" required />
              {createState.errors?.username && (
                <p className="field-error">{createState.errors.username[0]}</p>
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
              {createState.errors?.password && (
                <p className="field-error">{createState.errors.password[0]}</p>
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
          <div className="flex justify-end gap-2 border-t border-[#D7DEE5] pt-3">
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
          <form action={updateAction} className="space-y-3">
            <input type="hidden" name="id" value={editing.id} />
            {updateState.message && (
              <div
                className={`rounded-lg border p-2.5 text-xs ${
                  updateState.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {updateState.message}
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
            <div className="flex justify-end gap-2 border-t border-[#D7DEE5] pt-3">
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
          <form action={passwordAction} className="space-y-3">
            <input type="hidden" name="id" value={passwordFor.id} />
            {passwordState.message && (
              <div
                className={`rounded-lg border p-2.5 text-xs ${
                  passwordState.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {passwordState.message}
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
              {passwordState.errors?.password && (
                <p className="field-error">{passwordState.errors.password[0]}</p>
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
              {passwordState.errors?.confirm && (
                <p className="field-error">{passwordState.errors.confirm[0]}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#D7DEE5] pt-3">
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
