import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { InvoiceEditor } from '@/components/invoice-editor';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  await requireUser();
  const company = await getCompanySettings();

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
      where: { isActive: true },
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
    />
  );
}
