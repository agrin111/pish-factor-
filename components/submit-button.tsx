'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

interface SubmitButtonProps {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  formAction?: (formData: FormData) => void;
  name?: string;
  value?: string;
  onClick?: () => void;
}

export function SubmitButton({
  children,
  className = 'btn btn-primary',
  pendingLabel = 'در حال ذخیره...',
  formAction,
  name,
  value,
  onClick,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      formAction={formAction}
      name={name}
      value={value}
      onClick={onClick}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
