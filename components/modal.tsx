'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export { EmptyState } from '@/components/ui/empty-state';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ open, title, onClose, children, wide }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (element) => element.getClientRects().length > 0,
      );

    panel?.focus({ preventScroll: true });

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handler, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler, true);
      document.body.style.overflow = '';
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/60 p-3 sm:p-6">
      <div
        ref={panelRef}
        tabIndex={-1}
        className="my-4 w-full rounded-[14px] border border-line bg-white shadow-[0_24px_60px_-30px_rgba(15,26,36,0.5)] outline-none"
        style={{ maxWidth: wide ? 1080 : 640 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-bold text-ink-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-steel-500 hover:bg-surface hover:text-ink-900"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
