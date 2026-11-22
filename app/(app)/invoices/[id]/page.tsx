import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, UserRound } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getCompanySettings, resolveLetterhead } from '@/lib/settings';
import { InvoiceDocument } from '@/components/invoice-document';
import { InvoiceActions } from '@/components/invoice-actions';
import { InvoiceOutputControls } from '@/components/invoice-output-controls';
import { formatJalali } from '@/lib/jalali';
import { formatDocumentNumber } from '@/lib/format';
import { effectiveStatus } from '@/lib/quotation-status';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: { orderBy: { rowIndex: 'asc' } },
      createdBy: { select: { fullName: true } },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        include: { changedBy: { select: { fullName: true } } },
      },
    },
  });

  if (!quotation) notFound();
  if (user.role !== 'ADMIN' && quotation.createdById !== user.id) notFound();

  const company = await getCompanySettings();
  const letterhead = resolveLetterhead(company, quotation.letterheadType ?? 'MAIN');
  const shownStatus = effectiveStatus(quotation);
  const canEdit =
    user.role === 'ADMIN' || !['APPROVED', 'CANCELLED'].includes(quotation.status);

  const shareData = {
    id: quotation.id,
    number: quotation.number,
    issueDate: quotation.issueDate.toISOString(),
    validUntil: quotation.validUntil.toISOString(),
    validDays: quotation.validDays,
    customerName: quotation.customerName,
    customerMobile: quotation.customerMobile,
    customerCompany: quotation.customerCompany,
    currency: quotation.currency,
    grandTotal: quotation.grandTotal.toString(),
    paymentTerms: quotation.paymentTerms,
    deliveryTerms: quotation.deliveryTerms,
    companyName: letterhead.companyName,
    companyPhone: letterhead.phone,
    smtpConfigured: Boolean(company.smtpHost && company.smtpUser && company.smtpPass),
    items: quotation.items.map((item) => ({
      rowIndex: item.rowIndex,
      productName: item.productName,
      size: item.size,
      unit: item.unit,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="numeric text-lg font-bold">
              {formatDocumentNumber(quotation.number)}
            </h1>
            <span className={STATUS_BADGE[shownStatus]}>{STATUS_LABEL[shownStatus]}</span>
          </div>
          <p className="muted mt-1 text-xs">
            {quotation.customerName} · صدور <span className="numeric">{formatJalali(quotation.issueDate)}</span> ·
            صادرکننده {quotation.createdBy.fullName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/invoices" className="btn btn-secondary">
            بازگشت
          </Link>
          {canEdit && (
            <Link href={`/invoices/${quotation.id}/edit`} className="btn btn-secondary">
              <Pencil className="h-4 w-4" />
              ویرایش
            </Link>
          )}
          <InvoiceOutputControls
            id={quotation.id}
            documentNumber={quotation.number}
            customerName={quotation.customerName}
            issueDate={quotation.issueDate.toISOString()}
            shareData={shareData}
          />
        </div>
      </div>

      <div className="no-print card card-pad">
        <InvoiceActions
          id={quotation.id}
          documentNumber={quotation.number}
          customerName={quotation.customerName}
          issueDate={quotation.issueDate.toISOString()}
          status={quotation.status}
          canEdit={canEdit}
          canDelete={user.role === 'ADMIN'}
        />
      </div>

      <InvoiceDocument
        company={company}
        quotation={{
          id: quotation.id,
          number: quotation.number,
          status: quotation.status,
          issueDate: quotation.issueDate,
          validUntil: quotation.validUntil,
          validDays: quotation.validDays,
          customerName: quotation.customerName,
          customerMobile: quotation.customerMobile,
          customerCompany: quotation.customerCompany,
          customerAddress: quotation.customerAddress,
          currency: quotation.currency,
          includeVat: quotation.includeVat,
          vatRate: quotation.vatRate.toString(),
          itemsSubtotal: quotation.itemsSubtotal.toString(),
          transportCost: quotation.transportCost.toString(),
          discountAmount: quotation.discountAmount.toString(),
          vatAmount: quotation.vatAmount.toString(),
          grandTotal: quotation.grandTotal.toString(),
          paymentTerms: quotation.paymentTerms,
          deliveryTerms: quotation.deliveryTerms,
          notes: quotation.notes,
          letterheadType: quotation.letterheadType,
          createdByName: quotation.createdBy.fullName,
          items: quotation.items.map((item) => ({
            id: item.id,
            rowIndex: item.rowIndex,
            productName: item.productName,
            specs: item.specs,
            size: item.size,
            unit: item.unit,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString(),
          })),
        }}
      />

      <div className="no-print card">
        <div className="border-b border-[#D7DEE5] px-5 py-3.5">
          <h2 className="section-title">تاریخچه وضعیت</h2>
        </div>
        <ul className="divide-y divide-[#EEF1F4]">
          {quotation.statusHistory.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#F1F3F5] p-1">
                  <UserRound className="h-3 w-3 text-[#347C65]" />
                </span>
                <span>
                  {entry.fromStatus ? (
                    <>
                      تغییر از «{STATUS_LABEL[entry.fromStatus]}» به{' '}
                      <span className="font-semibold">«{STATUS_LABEL[entry.toStatus]}»</span>
                    </>
                  ) : (
                    <>ثبت اولیه با وضعیت «{STATUS_LABEL[entry.toStatus]}»</>
                  )}
                </span>
                {entry.note && <span className="muted">— {entry.note}</span>}
              </div>
              <div className="muted flex items-center gap-2 text-[11px]">
                <span>{entry.changedBy.fullName}</span>
                <span className="numeric" dir="ltr">
                  {new Intl.DateTimeFormat('fa-IR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(entry.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
