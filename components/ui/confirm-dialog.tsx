'use client';

import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  tone = 'primary',
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      {description ? (
        <p className="text-xs leading-relaxed text-steel-600">{description}</p>
      ) : null}
      <div className="mt-5 flex justify-start gap-2">
        <Button variant={tone} onClick={onConfirm} disabled={pending}>
          {pending ? 'در حال انجام…' : confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
}
