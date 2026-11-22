'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, Printer } from 'lucide-react';
import {
  applyPrintPaperSize,
  downloadInvoicePdf,
  printCurrentDocument,
  type PaperSize,
} from '@/lib/print-and-pdf';

interface Props {
  id: string;
  documentNumber: string;
}

export function InvoiceOutputControls({ id, documentNumber }: Props) {
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [printing, setPrinting] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
    filePath?: string;
  } | null>(null);

  useEffect(() => {
    applyPrintPaperSize(paperSize);
  }, [paperSize]);

  const handlePrint = async () => {
    setFeedback(null);
    setPrinting(true);
    try {
      const res = await printCurrentDocument(paperSize);
      if (!res.ok && !res.canceled) {
        setFeedback({ ok: false, message: res.error || 'ارسال به چاپگر با خطا مواجه شد.' });
      }
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setFeedback(null);
    setSavingPdf(true);
    try {
      const res = await downloadInvoicePdf(id, documentNumber, paperSize);
      if (res.ok) {
        setFeedback({
          ok: true,
          message: res.filePath
            ? `فایل PDF (${paperSize}) ذخیره شد.`
            : `فایل PDF (${paperSize}) آماده دانلود شد.`,
          filePath: res.filePath,
        });
      } else if (!res.canceled) {
        setFeedback({ ok: false, message: res.error || 'ذخیره فایل PDF با خطا مواجه شد.' });
      }
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex items-center gap-1 rounded-[10px] border border-[#D7DEE5] bg-white px-1.5 py-1 text-xs"
          role="group"
          aria-label="انتخاب اندازه برگه"
        >
          <span className="px-1.5 text-[11px] text-[#6B7A88]">برگه:</span>
          <button
            type="button"
            onClick={() => setPaperSize('A4')}
            className={`rounded-md px-2.5 py-1 font-bold transition ${
              paperSize === 'A4'
                ? 'bg-[#172535] text-white'
                : 'text-[#4A5A6A] hover:bg-[#F1F3F5] hover:text-[#172535]'
            }`}
          >
            A4
          </button>
          <button
            type="button"
            onClick={() => setPaperSize('A5')}
            className={`rounded-md px-2.5 py-1 font-bold transition ${
              paperSize === 'A5'
                ? 'bg-[#172535] text-white'
                : 'text-[#4A5A6A] hover:bg-[#F1F3F5] hover:text-[#172535]'
            }`}
          >
            A5
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handlePrint}
          disabled={printing}
        >
          <Printer className="h-4 w-4" />
          {printing ? 'در حال ارسال...' : `چاپ (${paperSize})`}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDownloadPdf}
          disabled={savingPdf}
        >
          <Download className="h-4 w-4" />
          {savingPdf ? 'در حال ساخت PDF...' : `ذخیره PDF (${paperSize})`}
        </button>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          {feedback.filePath &&
            typeof window !== 'undefined' &&
            window.pishfactorDesktop?.openFilePath && (
              <button
                type="button"
                onClick={() => window.pishfactorDesktop?.openFilePath?.(feedback.filePath!)}
                className="inline-flex items-center gap-1 font-semibold underline hover:text-emerald-950"
              >
                <ExternalLink className="h-3 w-3" />
                باز کردن فایل
              </button>
            )}
        </div>
      )}
    </div>
  );
}
