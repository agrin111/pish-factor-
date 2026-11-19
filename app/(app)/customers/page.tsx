import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CustomersView } from '@/components/customers-view';
import { formatJalali } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const user = await requireUser();

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { quotations: true } } },
  });

  return (
    <CustomersView
      isAdmin={user.role === 'ADMIN'}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        secondaryPhone: customer.secondaryPhone,
        companyOrProject: customer.companyOrProject,
        customerType: customer.customerType,
        nationalId: customer.nationalId,
        economicCode: customer.economicCode,
        city: customer.city,
        address: customer.address,
        notes: customer.notes,
        createdAtLabel: formatJalali(customer.createdAt),
        quotationCount: customer._count.quotations,
      }))}
    />
  );
}
