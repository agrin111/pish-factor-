import { getClientIp, getSessionUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sanitizeCsvCell } from '@/lib/csv';
import { loadReport } from '@/lib/reports';
import { formatJalali, jalaliToDate, parseJalaliInput, toJalali, todayUtc } from '@/lib/jalali';
import { STATUS_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response('دسترسی غیرمجاز', { status: 401 });

  const today = todayUtc();
  const { jy, jm } = toJalali(today);
  const defaultFrom = jalaliToDate(jy, jm, 1);

  const url = new URL(request.url);
  const from = (url.searchParams.get('from') && parseJalaliInput(url.searchParams.get('from')!)) || defaultFrom;
  const to = (url.searchParams.get('to') && parseJalaliInput(url.searchParams.get('to')!)) || today;

  const report = await loadReport({ id: user.id, role: user.role }, { from, to });

  const lines: string[] = [];
  lines.push(
    [
      sanitizeCsvCell('شماره پیش‌فاکتور'),
      sanitizeCsvCell('مشتری'),
      sanitizeCsvCell('موبایل'),
      sanitizeCsvCell('تاریخ صدور'),
      sanitizeCsvCell('صادرکننده'),
      sanitizeCsvCell('وضعیت'),
      sanitizeCsvCell('وزن کل (کیلوگرم)'),
      sanitizeCsvCell('واحد پول'),
      sanitizeCsvCell('مبلغ نهایی'),
    ].join(','),
  );

  for (const row of report.documents) {
    lines.push(
      [
        sanitizeCsvCell(row.number),
        sanitizeCsvCell(row.customerName),
        sanitizeCsvCell(row.customerMobile),
        sanitizeCsvCell(formatJalali(row.issueDate)),
        sanitizeCsvCell(row.userName),
        sanitizeCsvCell(STATUS_LABEL[row.status]),
        sanitizeCsvCell(row.totalWeightKg),
        sanitizeCsvCell(row.currency === 'RIAL' ? 'ریال' : 'تومان'),
        sanitizeCsvCell(row.amount),
      ].join(','),
    );
  }

  lines.push('');
  lines.push(
    [
      sanitizeCsvCell('تعداد کل'),
      sanitizeCsvCell(report.totalCount),
      sanitizeCsvCell('مجموع مبالغ'),
      sanitizeCsvCell(report.totalAmount),
    ].join(','),
  );
  lines.push(
    [
      sanitizeCsvCell('تأییدشده'),
      sanitizeCsvCell(report.approvedCount),
      sanitizeCsvCell('مبلغ تأییدشده'),
      sanitizeCsvCell(report.approvedAmount),
    ].join(','),
  );
  lines.push(
    [
      sanitizeCsvCell('لغوشده'),
      sanitizeCsvCell(report.cancelledCount),
      sanitizeCsvCell('در انتظار'),
      sanitizeCsvCell(report.sentCount),
    ].join(','),
  );

  await logAudit({
    actorId: user.id,
    actorName: user.fullName,
    action: 'REPORT_EXPORT',
    entityType: 'report',
    summary: `دریافت خروجی CSV گزارش فروش (${formatJalali(from)} تا ${formatJalali(to)})`,
    ipAddress: await getClientIp(),
  });

  const csv = `\uFEFF${lines.join('\r\n')}`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales-report-${formatJalali(from).replace(/[^0-9۰-۹]/g, '')}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
