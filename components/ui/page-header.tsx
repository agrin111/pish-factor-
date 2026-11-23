import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink-900">{title}</h1>
          {meta}
        </div>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-steel-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
