import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getCompanySettings, resolveLetterhead } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'برای دریافت اطلاعات باید وارد سامانه شوید.' },
      { status: 401 },
    );
  }

  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { rowIndex: 'asc' } } },
  });

  if (!quotation) {
    return NextResponse.json({ ok: false, message: 'پیش‌فاکتور یافت نشد.' }, { status: 404 });
  }
  if (user.role !== 'ADMIN' && quotation.createdById !== user.id) {
    return NextResponse.json({ ok: false, message: 'دسترسی مجاز نیست.' }, { status: 403 });
  }

  const company = await getCompanySettings();
  const letterhead = resolveLetterhead(company, quotation.letterheadType ?? 'MAIN');

  return NextResponse.json({
    ok: true,
    data: {
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
    },
  });
}
