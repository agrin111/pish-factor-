'use client';

import { useActionState } from 'react';
import { AlertCircle, Lock, LogIn, User } from 'lucide-react';
import { loginAction } from '@/actions/auth';
import { initialActionState } from '@/lib/forms';
import { SubmitButton } from '@/components/submit-button';

interface LoginFormProps {
  notice?: string;
}

export function LoginForm({ notice }: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="space-y-4">
      {notice && (
        <div className="alert alert-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {state.message && !state.ok && (
        <div
          role="alert"
          className="alert alert-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      <div>
        <label className="label" htmlFor="username">
          نام کاربری
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <input
            id="username"
            name="username"
            type="text"
            className="input pr-9"
            dir="ltr"
            autoComplete="username"
            autoFocus
            required
            aria-invalid={Boolean(state.errors?.username)}
            placeholder="نام کاربری خود را وارد کنید"
          />
        </div>
        {state.errors?.username && <p className="field-error">{state.errors.username[0]}</p>}
      </div>

      <div>
        <label className="label" htmlFor="password">
          رمز عبور
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <input
            id="password"
            name="password"
            type="password"
            className="input pr-9"
            dir="ltr"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state.errors?.password)}
          />
        </div>
        {state.errors?.password && <p className="field-error">{state.errors.password[0]}</p>}
      </div>

      <SubmitButton className="btn btn-primary w-full !py-2.5" pendingLabel="در حال ورود...">
        <LogIn className="h-4 w-4" />
        <span>ورود به سامانه</span>
      </SubmitButton>
    </form>
  );
}
