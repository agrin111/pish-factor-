'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

interface SubmitButtonProps {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  pending?: boolean;
  formAction?: (formData: FormData) => void;
  name?: string;
  value?: string;
  onClick?: () => void;
}

export function SubmitButton({
  children,
  className = 'btn btn-primary',
  pendingLabel = 'در حال ذخیره...',
  pending: externalPending,
  formAction,
  name,
  value,
  onClick,
}: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const isPending = Boolean(externalPending || formPending);
  return (
    <button
      type="submit"
      className={className}
      disabled={isPending}
      formAction={formAction}
      name={name}
      value={value}
      onClick={onClick}
    >
      {isPending ? pendingLabel : children}
    </button>
  );
}
