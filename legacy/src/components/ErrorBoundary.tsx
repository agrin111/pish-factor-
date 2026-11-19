import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'خطای غیرمنتظره در سامانه رخ داده است.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyText = 'در پردازش یا دسترسی به اطلاعات خطایی رخ داد.';
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error?.includes('Missing or insufficient permissions')) {
          friendlyText =
            'سطح دسترسی حساب کاربری شما برای این عملیات کافی نیست یا نشست شما منقضی شده است.';
        } else if (parsed?.error) {
          friendlyText = parsed.error;
        }
      } catch {
        friendlyText = this.state.errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#F1F3F5] flex items-center justify-center p-6" dir="rtl">
          <div className="bg-white border border-[#D7DEE5] rounded-xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-[#172535]">بروز خطا در سامانه</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{friendlyText}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#172535] hover:bg-slate-800 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>بارگذاری مجدد صفحه</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
