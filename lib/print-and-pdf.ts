'use client';

import {
  buildInvoicePdfFileName,
  parseContentDispositionFileName,
  type PdfFileNameInput,
} from '@/lib/pdf-filename';

export type PaperSize = 'A4' | 'A5';
export type PdfFileMeta = Pick<PdfFileNameInput, 'customerName' | 'issueDate'>;

export function applyPrintPaperSize(paperSize: PaperSize) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.paperSize = paperSize;
  const styleId = 'dynamic-print-page-size';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const margin = paperSize === 'A5' ? '7mm' : '10mm';
  styleEl.textContent = `@page { size: ${paperSize} portrait; margin: ${margin}; }`;
}

export async function printCurrentDocument(
  paperSize: PaperSize,
): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  applyPrintPaperSize(paperSize);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const desktop = typeof window !== 'undefined' ? window.pishfactorDesktop : undefined;
  if (desktop?.printDocument) {
    return desktop.printDocument(paperSize);
  }

  try {
    window.print();
    return { ok: true };
  } catch {
    return { ok: false, error: 'باز کردن پنجره چاپ مرورگر با خطا مواجه شد.' };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function fetchInvoicePdfBytes(
  id: string,
  documentNumber: string,
  paperSize: PaperSize,
  meta?: PdfFileMeta,
): Promise<{ ok: boolean; bytes?: Uint8Array; fileName?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`/api/invoices/${encodeURIComponent(id)}/pdf?paper=${paperSize}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, error: text || 'دریافت فایل PDF با خطا مواجه شد.' };
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.byteLength === 0) {
      return { ok: false, error: 'فایل PDF خروجی خالی است.' };
    }

    const fileName =
      meta?.customerName || meta?.issueDate
        ? buildInvoicePdfFileName({
            customerName: meta.customerName,
            issueDate: meta.issueDate,
            documentNumber,
            paperSize,
          })
        : parseContentDispositionFileName(response.headers.get('content-disposition')) ||
          buildInvoicePdfFileName({ documentNumber, paperSize });

    return { ok: true, bytes, fileName };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'زمان تولید فایل PDF به پایان رسید. لطفاً دوباره تلاش کنید.' };
    }
    return { ok: false, error: 'خطا در ارتباط با سرور برای تولید فایل PDF.' };
  } finally {
    clearTimeout(timer);
  }
}

export function triggerBrowserPdfDownload(bytes: Uint8Array, fileName: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadInvoicePdf(
  id: string,
  documentNumber: string,
  paperSize: PaperSize,
  meta?: PdfFileMeta,
): Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }> {
  const fetched = await fetchInvoicePdfBytes(id, documentNumber, paperSize, meta);
  if (!fetched.ok || !fetched.bytes || !fetched.fileName) {
    return { ok: false, error: fetched.error };
  }

  const desktop = typeof window !== 'undefined' ? window.pishfactorDesktop : undefined;
  if (desktop?.savePdf) {
    return desktop.savePdf(fetched.bytes, fetched.fileName);
  }

  triggerBrowserPdfDownload(fetched.bytes, fetched.fileName);
  return { ok: true };
}

export async function prepareSharePdfFile(
  id: string,
  documentNumber: string,
  paperSize: PaperSize,
  meta?: PdfFileMeta,
): Promise<{
  ok: boolean;
  bytes?: Uint8Array;
  fileName?: string;
  filePath?: string;
  error?: string;
}> {
  const fetched = await fetchInvoicePdfBytes(id, documentNumber, paperSize, meta);
  if (!fetched.ok || !fetched.bytes || !fetched.fileName) {
    return { ok: false, error: fetched.error };
  }

  const desktop = typeof window !== 'undefined' ? window.pishfactorDesktop : undefined;
  if (desktop?.saveSharePdf) {
    const saved = await withTimeout(
      desktop.saveSharePdf(fetched.bytes, fetched.fileName),
      8_000,
      { ok: false, error: 'ذخیره خودکار فایل PDF در پوشه خروجی با تأخیر مواجه شد.' },
    );
    if (!saved.ok) {
      return {
        ok: true,
        bytes: fetched.bytes,
        fileName: fetched.fileName,
        error: saved.error,
      };
    }
    return {
      ok: true,
      bytes: fetched.bytes,
      fileName: fetched.fileName,
      filePath: saved.filePath,
    };
  }

  return { ok: true, bytes: fetched.bytes, fileName: fetched.fileName };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const desktop = typeof window !== 'undefined' ? window.pishfactorDesktop : undefined;
  if (desktop?.writeClipboard) {
    const ok = await withTimeout(desktop.writeClipboard(text), 2_000, false);
    if (ok) return true;
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      const ok = await withTimeout(
        navigator.clipboard.writeText(text).then(() => true),
        2_000,
        false,
      );
      if (ok) return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function openExternalShareUrl(url: string): Promise<boolean> {
  const desktop = typeof window !== 'undefined' ? window.pishfactorDesktop : undefined;
  if (desktop?.openExternal) {
    return withTimeout(desktop.openExternal(url), 4_000, true);
  }
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    if (!url.startsWith('mailto:')) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  }
}

export function canUseNativeFileShare(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

export async function sharePdfWithSystemSheet(
  bytes: Uint8Array,
  fileName: string,
  title: string,
  text: string,
): Promise<{ ok: boolean; unsupported?: boolean; error?: string }> {
  if (!canUseNativeFileShare()) {
    return { ok: false, unsupported: true };
  }
  try {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const file = new File([copy.buffer], fileName, { type: 'application/pdf' });
    if (!navigator.canShare({ files: [file] })) {
      return { ok: false, unsupported: true };
    }
    await navigator.share({ title, text, files: [file] });
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false };
    }
    return { ok: false, error: 'اشتراک‌گذاری سیستمی فایل انجام نشد.' };
  }
}
