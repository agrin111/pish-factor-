import Link from 'next/link';
import { Download } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { loadReport } from '@/lib/reports';
import {
  formatCurrency,
  formatDocumentNumber,
  formatNumber,
  formatPersianText,
  toPersianDigits,
} from '@/lib/format';
import { formatJalali, jalaliToDate, parseJalaliInput, toJalali, todayUtc } from '@/lib/jalali';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/labels';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const company = await getCompanySettings();
  const params = await searchParams;

  const today = todayUtc();
  const { jy, jm } = toJalali(today);
  const defaultFrom = jalaliToDate(jy, jm, 1);

  const from = (params.from && parseJalaliInput(params.from)) || defaultFrom;
  const to = (params.to && parseJalaliInput(params.to)) || today;

  const report = await loadReport({ id: user.id, role: user.role }, { from, to });
  const currency = company.currency;

  const exportQuery = new URLSearchParams({
    from: formatJalali(from),
    to: formatJalali(to),
  }).toString();

  const cards = [
    { label: 'تعداد پیش‌فاکتور', value: formatNumber(report.totalCount, 0) },
    { label: 'مجموع مبالغ', value: formatCurrency(report.totalAmount, currency) },
    { label: 'تأییدشده', value: `${formatNumber(report.approvedCount, 0)} سند` },
    { label: 'مبلغ تأییدشده', value: formatCurrency(report.approvedAmount, currency) },
    { label: 'در انتظار پاسخ', value: `${formatNumber(report.sentCount, 0)} سند` },
    { label: 'لغوشده', value: `${formatNumber(report.cancelledCount, 0)} سند` },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="گزارش‌های فروش"
        description={
          <>
            بازه <span className="numeric">{formatJalali(from)}</span> تا{' '}
            <span className="numeric">{formatJalali(to)}</span>
            {user.role === 'SALES' ? ' — فقط اسناد شما' : ' — تمام کاربران'}
          </>
        }
        actions={
          <Link href={`/api/reports/export?${exportQuery}`} className="btn btn-secondary">
            <Download className="h-4 w-4" />
            خروجی Excel (CSV)
          </Link>
        }
      />

      <form className="card card-pad flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label" htmlFor="from">
            از تاریخ
          </label>
          <input
            id="from"
            name="from"
            className="input numeric"
            dir="ltr"
            defaultValue={formatJalali(from)}
          />
        </div>
        <div>
          <label className="label" htmlFor="to">
            تا تاریخ
          </label>
          <input id="to" name="to" className="input numeric" dir="ltr" defaultValue={formatJalali(to)} />
        </div>
        <button type="submit" className="btn btn-primary">
          اعمال بازه
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="card card-pad">
            <div className="muted text-xs">{card.label}</div>
            <div className="numeric mt-1 text-xl font-extrabold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="section-title">گزارش ماهانه</h2>
          </div>
          {report.monthly.length === 0 ? (
            <p className="muted p-5 text-xs">در این بازه سندی ثبت نشده است.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>ماه</th>
                  <th>تعداد</th>
                  <th>مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {report.monthly.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="numeric">{formatNumber(row.count, 0)}</td>
                    <td className="numeric">{formatCurrency(row.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="section-title">عملکرد کاربران</h2>
          </div>
          {report.users.length === 0 ? (
            <p className="muted p-5 text-xs">داده‌ای برای نمایش وجود ندارد.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>تعداد</th>
                  <th>تأییدشده</th>
                  <th>مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {report.users.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className="numeric">{formatNumber(row.count, 0)}</td>
                    <td className="numeric">{formatNumber(row.approved, 0)}</td>
                    <td className="numeric">{formatCurrency(row.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card lg:col-span-2">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="section-title">گزارش مشتریان (بر اساس مبلغ)</h2>
          </div>
          {report.customers.length === 0 ? (
            <p className="muted p-5 text-xs">داده‌ای برای نمایش وجود ندارد.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>مشتری</th>
                  <th>موبایل</th>
                  <th>تعداد سند</th>
                  <th>مجموع مبالغ</th>
                </tr>
              </thead>
              <tbody>
                {report.customers.map((row) => (
                  <tr key={`${row.name}-${row.mobile}`}>
                    <td className="font-semibold">{formatPersianText(row.name)}</td>
                    <td className="numeric" dir="ltr">
                      {toPersianDigits(row.mobile)}
                    </td>
                    <td className="numeric">{formatNumber(row.count, 0)}</td>
                    <td className="numeric">{formatCurrency(row.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="section-title">فهرست اسناد بازه</h2>
          <span className="muted numeric text-xs">
            {formatNumber(report.documents.length, 0)} سند
            {report.documents.length > 150 ? ' (نمایش ۱۵۰ سند اول — خروجی CSV کامل است)' : ''}
          </span>
        </div>
        {report.documents.length === 0 ? (
          <p className="muted p-5 text-xs">سندی در این بازه ثبت نشده است.</p>
        ) : (
          <div className="table-wrap !rounded-none !border-0">
            <table className="data">
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>مشتری</th>
                  <th>موبایل</th>
                  <th>تاریخ</th>
                  <th>صادرکننده</th>
                  <th>وزن کل</th>
                  <th>مبلغ</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {report.documents.slice(0, 150).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/invoices/${row.id}`} className="numeric font-semibold hover:text-accent-600">
                        {formatDocumentNumber(row.number)}
                      </Link>
                    </td>
                    <td>{formatPersianText(row.customerName)}</td>
                    <td className="numeric" dir="ltr">
                      {row.customerMobile ? toPersianDigits(row.customerMobile) : '—'}
                    </td>
                    <td className="numeric">{formatJalali(row.issueDate)}</td>
                    <td>{row.userName}</td>
                    <td className="numeric">
                      {row.totalWeightKg > 0 ? `${formatNumber(row.totalWeightKg, 2)} ک‌گ` : '—'}
                    </td>
                    <td className="numeric">{formatCurrency(row.amount, row.currency)}</td>
                    <td>
                      <span className={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
