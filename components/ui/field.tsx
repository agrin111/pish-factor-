import type { ReactNode } from 'react';

export function Field({
  htmlFor,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  htmlFor?: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = htmlFor && (error || hint) ? `${htmlFor}-desc` : undefined;

  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={describedBy} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={describedBy}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
