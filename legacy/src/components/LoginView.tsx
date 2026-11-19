import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { LogIn, ShieldCheck, AlertCircle, LogOut } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { BrandLogo } from './BrandLogo';

interface LoginViewProps {
  inactiveMessage?: string;
  onSignOutInactive?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  inactiveMessage,
  onSignOutInactive,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('پنجره ورود بسته شد. لطفاً مجدداً تلاش کنید.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg('مرورگر پنجره ورود را مسدود کرده است. لطفاً Pop-up را مجاز کنید.');
      } else {
        setErrorMsg('ورود با خطا مواجه شد. لطفاً اتصال اینترنت و تنظیمات مرورگر را بررسی کنید.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F3F5] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-[#D7DEE5] rounded-2xl overflow-hidden shadow-sm">
        {/* Top Navy Header */}
        <div className="bg-[#172535] px-8 py-7 text-white flex items-center gap-4">
          <BrandLogo size="lg" variant="light" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Aghrin PishFactor</h1>
            <p className="text-xs text-slate-300 mt-1">
              سامانه اختصاصی صدور پیش‌فاکتور و فروش شرکت آهن آگرین
            </p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {inactiveMessage ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">حساب کاربری غیرفعال است</div>
                  <p className="text-xs mt-1 leading-relaxed">{inactiveMessage}</p>
                </div>
              </div>
              {onSignOutInactive && (
                <button
                  type="button"
                  onClick={() => {
                    void signOut(auth);
                    onSignOutInactive();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#172535] hover:bg-slate-800 text-white text-sm font-medium rounded-lg cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج و ورود با حساب دیگر</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-[#172535]">ورود به پنل سازمانی</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  برای دسترسی به داشبورد فروش، مشتریان، قیمت‌گذاری و صدور پیش‌فاکتور رسمی با حساب
                  کاربری مجاز خود وارد شوید.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-[#347C65] hover:bg-[#2c6a56] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'در حال اتصال به احراز هویت...' : 'ورود امن با حساب Google'}</span>
              </button>

              <div className="pt-4 border-t border-[#D7DEE5] flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-[#347C65] shrink-0" />
                <span>
                  دسترسی مبتنی بر نقش (مدیر سیستم / کارمند فروش) و ثبت خودکار تاریخچه عملیات فعال است.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
