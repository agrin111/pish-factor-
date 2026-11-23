'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // خطا برای بررسی در کنسول سرور/مرورگر باقی می‌ماند
    console.error(error);
  }, [error]);

  return (
    <div className="card card-pad mx-auto max-w-xl text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="mt-3 text-base font-bold text-ink-900">خطایی در بارگذاری این صفحه رخ داد</h1>
      <p className="muted mx-auto mt-1 max-w-sm text-xs leading-relaxed">
        داده‌های ثبت‌شده حذف نشده‌اند. یک بار دیگر تلاش کنید؛ اگر خطا تکرار شد، با مدیر سیستم تماس
        بگیرید.
      </p>
      {error.digest ? (
        <p className="muted numeric mt-2 text-[10px]" dir="ltr">
          {error.digest}
        </p>
      ) : null}
      <div className="mt-4 flex justify-center">
        <Button onClick={reset}>تلاش دوباره</Button>
      </div>
    </div>
  );
}
