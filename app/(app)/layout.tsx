import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCompanySettings } from '@/lib/settings';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const company = await getCompanySettings();

  const [invoices, customers, products] = await Promise.all([
    prisma.quotation.count(),
    prisma.customer.count(),
    prisma.product.count(),
  ]);

  return (
    <AppShell
      user={{ id: user.id, fullName: user.fullName, username: user.username, role: user.role }}
      companyName={company.companyName}
      logoDataUrl={company.logoDataUrl}
      counts={{ invoices, customers, products }}
    >
      {children}
    </AppShell>
  );
}
