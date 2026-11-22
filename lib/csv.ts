/**
 * ایمن‌سازی سلول CSV در برابر تزریق فرمول در Excel/Calc
 * و فرار صحیح نقل‌قول‌ها برای خروجی استاندارد UTF-8.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  const raw = String(value ?? '');
  const trimmedStart = raw.replace(/^\s+/, '');
  const safe = /^[=+\-@\t\r]/.test(trimmedStart) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
