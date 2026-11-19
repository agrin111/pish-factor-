import React, { useEffect, useState } from 'react';
import { UserPlus, Shield, Activity } from 'lucide-react';
import { AuditLog, StaffInvite, UserProfile, UserRole } from '../types';
import {
  createStaffInviteDoc,
  fetchAuditLogs,
  updateUserRoleAndStatus,
} from '../services/firestoreService';

interface UsersViewProps {
  users: UserProfile[];
  invites: StaffInvite[];
  currentUser: UserProfile;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, invites, currentUser }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('sales');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    void fetchAuditLogs(40).then(setAuditLogs).catch(() => {});
  }, [users.length]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setSubmitting(true);
    setFeedback('');
    try {
      await createStaffInviteDoc(
        {
          email: inviteEmail.trim(),
          displayName: inviteName.trim(),
          role: inviteRole,
        },
        currentUser
      );
      setInviteEmail('');
      setInviteName('');
      setFeedback('دعوت‌نامه همکار ثبت شد. پس از ورود با ایمیل Google، پروفایل او متصل می‌شود.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#172535]">مدیریت کاربران، نقش‌ها و لاگ فعالیت‌ها</h1>
        <p className="text-sm text-slate-500 mt-1">
          تعیین سطح دسترسی مدیر سیستم و کارمند فروش، غیرفعال‌سازی حساب‌ها و بررسی Audit Log
        </p>
      </div>

      {/* Invite New Staff */}
      <form
        onSubmit={(e) => void handleInvite(e)}
        className="bg-white border border-[#D7DEE5] rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-[#172535]">
          <UserPlus className="w-4 h-4 text-[#347C65]" />
          <span>افزودن / دعوت کاربر همکار</span>
        </div>

        {feedback && (
          <div className="p-3 rounded-lg bg-[#347C65]/10 border border-[#347C65]/30 text-[#172535] text-xs">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="نام و نام خانوادگی همکار *"
            className="px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
          />
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="ایمیل Google همکار *"
            dir="ltr"
            className="px-3 py-2 text-sm font-mono-num border border-[#D7DEE5] rounded-lg"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as UserRole)}
            className="px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg bg-white"
          >
            <option value="sales">کارمند فروش</option>
            <option value="admin">مدیر سیستم</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold bg-[#347C65] hover:bg-[#2c6a56] text-white rounded-lg cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'در حال ثبت...' : 'ثبت کاربر همکار'}
          </button>
        </div>

        {invites.length > 0 && (
          <div className="pt-2 text-xs text-slate-500">
            دعوت‌نامه‌های ثبت‌شده:{' '}
            {invites.map((inv) => `${inv.displayName} (${inv.email})`).join(' · ')}
          </div>
        )}
      </form>

      {/* Active Users Table */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D7DEE5] flex items-center gap-2 font-bold text-sm text-[#172535]">
          <Shield className="w-4 h-4 text-[#172535]" />
          <span>کاربران ثبت‌شده در سیستم ({users.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F1F3F5] text-slate-500 text-xs border-b border-[#D7DEE5]">
              <tr>
                <th className="text-right font-medium px-4 py-3">نام کاربر</th>
                <th className="text-right font-medium px-4 py-3">ایمیل</th>
                <th className="text-right font-medium px-4 py-3">نقش دسترسی</th>
                <th className="text-center font-medium px-4 py-3">وضعیت حساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.uid === currentUser.uid;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-[#172535]">{u.displayName}</td>
                    <td className="px-4 py-3 font-mono-num text-xs text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        disabled={isSelf}
                        value={u.role}
                        onChange={(e) =>
                          void updateUserRoleAndStatus(
                            u,
                            {
                              displayName: u.displayName,
                              role: e.target.value as UserRole,
                              isActive: u.isActive,
                              phone: u.phone,
                            },
                            currentUser
                          )
                        }
                        className="px-2.5 py-1 text-xs border border-[#D7DEE5] rounded-md bg-white disabled:opacity-60"
                      >
                        <option value="admin">مدیر سیستم</option>
                        <option value="sales">کارمند فروش</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() =>
                          void updateUserRoleAndStatus(
                            u,
                            {
                              displayName: u.displayName,
                              role: u.role,
                              isActive: !u.isActive,
                              phone: u.phone,
                            },
                            currentUser
                          )
                        }
                        className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer disabled:opacity-50 ${
                          u.isActive
                            ? 'bg-[#347C65]/15 text-[#347C65]'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {u.isActive ? 'فعال' : 'غیرفعال'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D7DEE5] flex items-center gap-2 font-bold text-sm text-[#172535]">
          <Activity className="w-4 h-4 text-[#347C65]" />
          <span>تاریخچه عملیات سیستم (Audit Log)</span>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">هنوز رویدادی ثبت نشده است.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-semibold text-[#172535]">{log.summary}</span>
                  <span className="text-slate-400 mr-2 font-mono-num">[{log.action}]</span>
                </div>
                <div className="text-slate-500 shrink-0">{log.actorName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
