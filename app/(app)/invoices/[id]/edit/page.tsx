import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { InvoiceEditor } from '@/components/invoice-editor';
import { formatJalali } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const company = await getCompanySettings();

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { rowIndex: 'asc' } } },
  });

  if (!quotation) notFound();

  const canEdit =
    user.role === 'ADMIN' ||
    (quotation.createdById === user.id && !['APPROVED', 'CANCELLED'].includes(quotation.status));

  if (!canEdit) redirect(`/invoices/${id}`);

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        mobile: true,
        secondaryPhone: true,
        companyOrProject: true,
        nationalId: true,
        economicCode: true,
        city: true,
        address: true,
      },
    }),
    prisma.product.findMany({
      where: { OR: [{ isActive: true }, { id: { in: quotation.items.map((item) => item.productId ?? '') } }] },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        factory: true,
        specs: true,
        size: true,
        thickness: true,
        length: true,
        unit: true,
        unitPrice: true,
        weightPerUnitKg: true,
      },
    }),
  ]);

  return (
    <InvoiceEditor
      customers={customers}
      products={products.map((product) => ({
        ...product,
        unitPrice: product.unitPrice.toString(),
        weightPerUnitKg: product.weightPerUnitKg.toString(),
      }))}
      defaults={{
        currency: company.currency,
        includeVat: company.defaultIncludeVat,
        vatRate: company.defaultVatRate.toString(),
        validDays: company.defaultValidDays,
        paymentTerms: company.defaultPaymentTerms,
        deliveryTerms: company.defaultDeliveryTerms,
        notes: company.defaultNotes,
      }}
      existing={{
        id: quotation.id,
        number: quotation.number,
        customerId: quotation.customerId,
        issueDateLabel: formatJalali(quotation.issueDate),
        validDays: quotation.validDays,
        status: quotation.status,
        currency: quotation.currency,
        includeVat: quotation.includeVat,
        vatRate: quotation.vatRate.toString(),
        transportCost: quotation.transportCost.toString(),
        discountAmount: quotation.discountAmount.toString(),
        paymentTerms: quotation.paymentTerms,
        deliveryTerms: quotation.deliveryTerms,
        notes: quotation.notes,
        letterheadType: quotation.letterheadType,
        items: quotation.items.map((item) => {
          const qtyNum = Number(item.quantity.toString());
          const rowWeightNum = Number(item.weightKg.toString());
          const unitWeight =
            item.unit === 'KILOGRAM'
              ? '1'
              : item.unit === 'TON'
                ? '1000'
                : qtyNum > 0
                  ? String(Math.round((rowWeightNum / qtyNum) * 1000) / 1000)
                  : '0';
          return {
            id: item.id,
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            specs: item.specs,
            size: item.size,
            unit: item.unit,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            weightKg: unitWeight,
          };
        }),
      }}
    />
  );
}
