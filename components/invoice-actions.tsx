'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { Copy, Download, Eye, Pencil, Share2, Trash2 } from 'lucide-react';
import {
  changeQuotationStatusAction,
  deleteQuotationAction,
  duplicateQuotationAction,
} from '@/actions/quotations';
import { initialActionState } from '@/lib/forms';
import { Modal } from '@/components/modal';
import { SubmitButton } from '@/components/submit-button';
import { STATUS_LABEL, STATUSES } from '@/lib/labels';
import { downloadInvoicePdf } from '@/lib/print-and-pdf';
import { InvoiceShareModal } from '@/components/invoice-share-modal';
import type { QuotationStatus } from '@prisma/client';

interface Props {
  id: string;
  documentNumber?: string;
  status: QuotationStatus;
  canEdit: boolean;
  canDelete: boolean;
}

export function InvoiceActions({ id, documentNumber, status, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [statusState, statusAction] = useActionState(changeQuotationStatusAction, initialActionState);
  const [duplicateState, duplicateAction] = useActionState(
    duplicateQuotationAction,
    initialActionState,
  );
  const [deleteState, deleteAction] = useActionState(deleteQuotationAction, initialActionState);

  useEffect(() => {
    if (statusState.ok) {
      setStatusOpen(false);
      router.refresh();
    }
  }, [statusState, router]);

  useEffect(() => {
    if (deleteState.ok) {
      setDeleteOpen(false);
      router.refresh();
    }
  }, [deleteState, router]);

  useEffect(() => {
    if (duplicateState.ok) router.refresh();
  }, [duplicateState, router]);

  return (
    <div className="row-actions">
      <Link href={`/invoices/${id}`} className="btn btn-secondary btn-sm" title="مشاهده سند">
        <Eye className="h-3.5 w-3.5" />
      </Link>

      <button
        type="button"
        onClick={async () => {
          setPdfError('');
          setDownloadingPdf(true);
          try {
            const res = await downloadInvoicePdf(id, documentNumber ?? id, 'A4');
            if (!res.ok && !res.canceled && res.error) {
              setPdfError(res.error);
            }
          } finally {
            setDownloadingPdf(false);
          }
        }}
        disabled={downloadingPdf}
        className="btn btn-secondary btn-sm"
        title="ذخیره PDF"
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="btn btn-secondary btn-sm"
        title="اشتراک‌گذاری در واتساپ، تلگرام، بله یا ایمیل"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>

      {canEdit && (
        <Link href={`/invoices/${id}/edit`} className="btn btn-secondary btn-sm" title="ویرایش">
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      )}

      <form action={duplicateAction}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="...">
          <Copy className="h-3.5 w-3.5" />
          کپی
        </SubmitButton>
      </form>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setStatusOpen(true)}
        title="تغییر وضعیت"
      >
        وضعیت
      </button>

      {canDelete && (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => setDeleteOpen(true)}
          title="حذف"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {duplicateState.message && !duplicateState.ok && (
        <span className="text-[10px] text-rose-700">{duplicateState.message}</span>
      )}
      {pdfError && <span className="text-[10px] text-rose-700">{pdfError}</span>}

      <Modal open={statusOpen} title="تغییر وضعیت پیش‌فاکتور" onClose={() => setStatusOpen(false)}>
        <form action={statusAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          {statusState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                statusState.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {statusState.message}
            </div>
          )}
          <div>
            <label className="label" htmlFor={`status-${id}`}>
              وضعیت جدید
            </label>
            <select
              id={`status-${id}`}
              name="status"
              className="select"
              defaultValue={status === 'EXPIRED' ? 'SENT' : status}
            >
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`note-${id}`}>
              یادداشت (اختیاری)
            </label>
            <input id={`note-${id}`} name="note" className="input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setStatusOpen(false)}>
              انصراف
            </button>
            <SubmitButton className="btn btn-primary">ثبت وضعیت</SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal open={deleteOpen} title="حذف پیش‌فاکتور" onClose={() => setDeleteOpen(false)}>
        <form action={deleteAction} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          {deleteState.message && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
              {deleteState.message}
            </div>
          )}
          <p className="text-sm leading-relaxed">
            حذف پیش‌فاکتور قابل بازگشت نیست و تاریخچه وضعیت آن نیز پاک می‌شود. برای حفظ سوابق بهتر است
            وضعیت سند را «لغوشده» ثبت کنید.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>
              انصراف
            </button>
            <SubmitButton className="btn btn-danger">حذف نهایی</SubmitButton>
          </div>
        </form>
      </Modal>

      <InvoiceShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        quotationId={id}
        documentNumber={documentNumber ?? id}
      />
    </div>
  );
}
