import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'badge-gray',
  accent: 'badge-accent',
  success: 'badge-green',
  warning: 'badge-amber',
  danger: 'badge-red',
  info: 'badge-blue',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={['badge', TONE_CLASS[tone], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
