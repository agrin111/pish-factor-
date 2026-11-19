import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import type { Prisma, QuotationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatCurrency } from '@/lib/format';
import { formatJalali, parseJalaliInput } from '@/lib/jalali';
import { STATUS_BADGE, STATUS_LABEL, STATUSES } from '@/lib/labels';
import { effectiveStatus, statusWhere } from '@/lib/quotation-status';
import { InvoiceActions } from '@/components/invoice-actions';
import { getCompanySettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Search {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  user?: string;
  page?: string;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const company = await getCompanySettings();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = STATUSES.includes(params.status as QuotationStatus)
    ? (params.status as QuotationStatus)
    : undefined;

  const where: Prisma.QuotationWhereInput = {};

  if (user.role !== 'ADMIN') {
    where.createdById = user.id;
  } else if (params.user) {
    where.createdById = params.user;
  }

  if (params.q) {
    where.OR = [
      { number: { contains: params.q, mode: 'insensitive' } },
      { customerName: { contains: params.q, mode: 'insensitive' } },
      { customerMobile: { contains: params.q } },
      { customerCompany: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  if (status) {
    Object.assign(where, statusWhere(status));
  }

  const from = params.from ? parseJalaliInput(params.from) : null;
  const to = params.to ? parseJalaliInput(params.to) : null;
  if (from || to) {
    where.issueDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }

  const [rows, total, users] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { createdBy: { select: { fullName: true } } },
    }),
    prisma.quotation.count({ where }),
    user.role === 'ADMIN'
      ? prisma.user.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } })
      : Promise.resolve([]),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildQuery = (overrides: Partial<Search>) => {
    const query = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value && key !== 'page') query.set(key, String(value));
    }
    if (merged.page && Number(merged.page) > 1) query.set('page', String(merged.page));
    const string = query.toString();
    return string ? `/invoices?${string}` : '/invoices';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">آرشیو پیش‌فاکتورها</h1>
          <p className="muted mt-1 text-xs">
            {user.role === 'ADMIN'
              ? 'تمام اسناد صادرشده در سامانه'
              : 'پیش‌فاکتورهای صادرشده توسط شما'}
          </p>
        </div>
        <Link href="/invoices/new" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          صدور پیش‌فاکتور جدید
        </Link>
      </div>

      <form className="card card-pad grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="q">
            جستجو
          </label>
          <input
            id="q"
            name="q"
            className="input"
            defaultValue={params.q ?? ''}
            placeholder="شماره پیش‌فاکتور، نام یا موبایل مشتری"
          />
        </div>
        <div>
          <label className="label" htmlFor="status">
            وضعیت
          </label>
          <select id="status" name="status" className="select" defaultValue={params.status ?? ''}>
            <option value="">همه وضعیت‌ها</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABEL[item]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">
            از تاریخ
          </label>
          <input
            id="from"
            name="from"
            className="input numeric"
            dir="ltr"
            placeholder="۱۴۰۵/۰۸/۰۱"
            defaultValue={params.from ?? ''}
          />
        </div>
        <div>
          <label className="label" htmlFor="to">
            تا تاریخ
          </label>
          <input
            id="to"
            name="to"
            className="input numeric"
            dir="ltr"
            placeholder="۱۴۰۵/۰۸/۳۰"
            defaultValue={params.to ?? ''}
          />
        </div>
        {user.role === 'ADMIN' && (
          <div>
            <label className="label" htmlFor="user">
              صادرکننده
            </label>
            <select id="user" name="user" className="select" defaultValue={params.user ?? ''}>
              <option value="">همه کاربران</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2 lg:col-span-6">
          <button type="submit" className="btn btn-navy">
            اعمال فیلتر
          </button>
          <Link href="/invoices" className="btn btn-secondary">
            حذف فیلترها
          </Link>
          <span className="muted mr-auto text-xs numeric">
            {new Intl.NumberFormat('fa-IR').format(total)} سند
          </span>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D7DEE5] bg-white p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold">پیش‌فاکتوری یافت نشد</p>
          <p className="muted mt-1 text-xs">
            {total === 0 ? 'با دکمه «صدور پیش‌فاکتور جدید» اولین سند را ایجاد کنید.' : 'فیلترها را تغییر دهید.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>شماره</th>
                <th>مشتری</th>
                <th>تاریخ صدور</th>
                <th>اعتبار تا</th>
                <th>مبلغ نهایی</th>
                <th>وضعیت</th>
                <th>صادرکننده</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const shownStatus = effectiveStatus(row);
                const canEdit =
                  user.role === 'ADMIN' ||
                  (row.createdById === user.id && !['APPROVED', 'CANCELLED'].includes(row.status));
                return (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/invoices/${row.id}`}
                        className="numeric font-semibold hover:text-[#347C65]"
                      >
                        {row.number}
                      </Link>
                    </td>
                    <td>
                      <div className="font-medium">{row.customerName}</div>
                      <div className="muted numeric text-[11px]" dir="ltr">
                        {row.customerMobile}
                      </div>
                    </td>
                    <td className="numeric">{formatJalali(row.issueDate)}</td>
                    <td className="numeric">{formatJalali(row.validUntil)}</td>
                    <td className="numeric font-semibold">
                      {formatCurrency(row.grandTotal, row.currency)}
                    </td>
                    <td>
                      <span className={STATUS_BADGE[shownStatus]}>{STATUS_LABEL[shownStatus]}</span>
                    </td>
                    <td className="text-xs">{row.createdBy.fullName}</td>
                    <td>
                      <InvoiceActions
                        id={row.id}
                        status={row.status}
                        canEdit={canEdit}
                        canDelete={user.role === 'ADMIN'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
            <Link
              key={item}
              href={buildQuery({ page: String(item) })}
              className={`btn btn-sm ${item === page ? 'btn-navy' : 'btn-secondary'}`}
            >
              {new Intl.NumberFormat('fa-IR').format(item)}
            </Link>
          ))}
        </div>
      )}

      <p className="muted text-center text-[11px]">
        واحد پول پیش‌فرض: {company.currency === 'RIAL' ? 'ریال' : 'تومان'} — مبالغ هر سند بر اساس
        Snapshot زمان صدور نمایش داده می‌شوند.
      </p>
    </div>
  );
}
