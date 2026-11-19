import { getSessionUser } from '@/lib/auth';
import { loadReport } from '@/lib/reports';
import { formatJalali, parseJalaliInput, todayUtc } from '@/lib/jalali';
import { STATUS_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

function csvCell(value: string | number): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response('دسترسی غیرمجاز', { status: 401 });

  const url = new URL(request.url);
  const from = (url.searchParams.get('from') && parseJalaliInput(url.searchParams.get('from')!)) || todayUtc();
  const to = (url.searchParams.get('to') && parseJalaliInput(url.searchParams.get('to')!)) || todayUtc();

  const report = await loadReport({ id: user.id, role: user.role }, { from, to });

  const lines: string[] = [];
  lines.push([csvCell('شماره پیش‌فاکتور'), csvCell('مشتری'), csvCell('موبایل'), csvCell('تاریخ صدور'), csvCell('صادرکننده'), csvCell('وضعیت'), csvCell('مبلغ نهایی')].join(','));

  for (const row of report.documents) {
    lines.push(
      [
        csvCell(row.number),
        csvCell(row.customerName),
        csvCell(''),
        csvCell(formatJalali(row.issueDate)),
        csvCell(row.userName),
        csvCell(STATUS_LABEL[row.status]),
        csvCell(row.amount),
      ].join(','),
    );
  }

  lines.push('');
  lines.push([csvCell('تعداد کل'), csvCell(report.totalCount), csvCell('مجموع مبالغ'), csvCell(report.totalAmount)].join(','));
  lines.push([csvCell('تأییدشده'), csvCell(report.approvedCount), csvCell('مبلغ تأییدشده'), csvCell(report.approvedAmount)].join(','));
  lines.push([csvCell('لغوشده'), csvCell(report.cancelledCount), csvCell('در انتظار'), csvCell(report.sentCount)].join(','));

  const csv = `\uFEFF${lines.join('\r\n')}`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales-report-${formatJalali(from).replace(/[^0-9۰-۹]/g, '')}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
