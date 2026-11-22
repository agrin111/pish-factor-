'use client';

import { useState } from 'react';
import { ArrowUpCircle, CheckCircle2, Download, RefreshCw, X } from 'lucide-react';
import { toPersianDigits } from '@/lib/format';
import type { DesktopUpdateState } from '@/types/desktop';

interface UpdateToastProps {
  state: DesktopUpdateState | null;
  onUpdate: () => void;
  onInstall: () => void;
  onOpenReleases: () => void;
  onRetryCheck: () => void;
}

export function UpdateToast({
  state,
  onUpdate,
  onInstall,
  onOpenReleases,
  onRetryCheck,
}: UpdateToastProps) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  if (!state) return null;

  const isVisibleStatus =
    state.status === 'available' ||
    state.status === 'portable-available' ||
    state.status === 'downloading' ||
    state.status === 'downloaded';

  if (!isVisibleStatus) return null;

  const versionKey = `${state.status}:${state.availableVersion || 'next'}`;
  if (state.status !== 'downloading' && dismissedKey === versionKey) {
    return null;
  }

  const versionLabel = state.availableVersion ? toPersianDigits(state.availableVersion) : '';

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-5 left-5 z-50 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#D7DEE5] bg-white/95 shadow-[0_20px_50px_-15px_rgba(23,37,53,0.35)] backdrop-blur-md"
    >
      <div className="h-1 w-full bg-gradient-to-l from-[#347c65] via-[#5fb79b] to-[#172535]" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf6f1] text-[#2c6a56]">
            {state.status === 'downloaded' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : state.status === 'downloading' ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUpCircle className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold text-[#172535]">
                {state.status === 'downloading'
                  ? `در حال دریافت نسخه ${versionLabel}`
                  : state.status === 'downloaded'
                    ? `نسخه ${versionLabel} آماده جایگزینی است`
                    : `نسخه جدید ${versionLabel} منتشر شد`}
              </h4>
              {state.status !== 'downloading' && (
                <button
                  type="button"
                  onClick={() => setDismissedKey(versionKey)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="بستن اعلان به‌روزرسانی"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="mt-1 text-xs leading-relaxed text-[#48586a]">
              {state.status === 'downloading'
                ? 'دریافت فایل اجرایی جدید در حال انجام است؛ می‌توانید به کار خود ادامه دهید.'
                : state.status === 'downloaded'
                  ? 'با تأیید شما برنامه بسته شده، فایل اجرایی جایگزین می‌شود و نسخه جدید اجرا می‌گردد.'
                  : 'نسخه جدید روی سرور در دسترس است. تمام اطلاعات و فاکتورهای شما بدون تغییر حفظ می‌شود.'}
            </p>

            {state.status === 'downloading' && (
              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef1f4]">
                  <div
                    className="h-full rounded-full bg-[#347c65] transition-all duration-200"
                    style={{ width: `${state.percent ?? 0}%` }}
                  />
                </div>
                <div className="numeric flex justify-between text-[11px] text-[#6b7a88]">
                  <span>پیشرفت دریافت</span>
                  <span>{toPersianDigits(state.percent ?? 0)}٪</span>
                </div>
              </div>
            )}

            {state.status !== 'downloading' && (
              <div className="mt-3 flex items-center gap-2">
                {state.status === 'available' && (
                  <button type="button" onClick={onUpdate} className="btn btn-primary btn-sm">
                    <Download className="h-3.5 w-3.5" />
                    <span>به‌روزرسانی</span>
                  </button>
                )}

                {state.status === 'downloaded' && (
                  <button type="button" onClick={onInstall} className="btn btn-primary btn-sm">
                    <Download className="h-3.5 w-3.5" />
                    <span>
                      {state.isPortable ? 'جایگزینی فایل اجرایی' : 'به‌روزرسانی و اجرا'}
                    </span>
                  </button>
                )}

                {state.status === 'portable-available' && (
                  <button type="button" onClick={onOpenReleases} className="btn btn-primary btn-sm">
                    <Download className="h-3.5 w-3.5" />
                    <span>به‌روزرسانی</span>
                  </button>
                )}

                {state.status !== 'available' &&
                  state.status !== 'downloaded' &&
                  state.status !== 'portable-available' && (
                    <button type="button" onClick={onRetryCheck} className="btn btn-secondary btn-sm">
                      <span>بررسی مجدد</span>
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => setDismissedKey(versionKey)}
                  className="btn btn-ghost btn-sm"
                >
                  <span>بعداً</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
