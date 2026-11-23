import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  hint,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  hint?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'rounded-[14px] border border-dashed border-line-strong bg-white px-6 py-10 text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {Icon ? (
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-steel-400">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {hint ? <p className="muted mx-auto mt-1 max-w-md text-xs leading-relaxed">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}
