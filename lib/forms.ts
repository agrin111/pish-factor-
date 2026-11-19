import type { ZodError } from 'zod';

export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  /** برای انتقال مقدار بازگشتی به فرم‌های چندمرحله‌ای */
  data?: unknown;
}

export const initialActionState: ActionState = { ok: false };

export function zodToState(error: ZodError): ActionState {
  const flat = error.flatten();
  return {
    ok: false,
    message: 'لطفاً خطاهای فرم را برطرف کنید.',
    errors: flat.fieldErrors as Record<string, string[]>,
  };
}

export function fail(message: string): ActionState {
  return { ok: false, message };
}

export function success(message?: string): ActionState {
  return { ok: true, message };
}
