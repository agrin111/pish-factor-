import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={['card', className].filter(Boolean).join(' ')}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={['card-head', className].filter(Boolean).join(' ')}>
      <div className="min-w-0">
        <h2 className="card-title">{title}</h2>
        {description ? <p className="card-desc">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={[padded ? 'card-pad' : '', className].filter(Boolean).join(' ')}>{children}</div>
  );
}
