'use client';

export type PaperSize = 'A4' | 'A5';

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

export async function downloadInvoicePdf(
  id: string,
  documentNumber: string,
  paperSize: PaperSize,
): Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }> {
  try {
    const response = await fetch(`/api/invoices/${encodeURIComponent(id)}/pdf?paper=${paperSize}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
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

    const safeNumber = documentNumber.replace(/[^A-Za-z0-9._-]/g, '_') || id;
    const fileName = `invoice-${safeNumber}-${paperSize}.pdf`;

    const desktop = typeof window !== 'undefined' ? window.pishfactorDesktop : undefined;
    if (desktop?.savePdf) {
      return desktop.savePdf(bytes, fileName);
    }

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true };
  } catch {
    return { ok: false, error: 'خطا در ارتباط با سرور برای تولید فایل PDF.' };
  }
}
