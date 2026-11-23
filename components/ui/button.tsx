import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ink' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ink: 'btn-ink',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: '',
  sm: 'btn-sm',
};

/**
 * ساخت کلاس دکمه برای جاهایی که دکمه، لینک است (next/link) یا نیاز به
 * ترکیب کلاس سفارشی دارد.
 */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return ['btn', VARIANT_CLASS[variant], SIZE_CLASS[size], extra].filter(Boolean).join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
