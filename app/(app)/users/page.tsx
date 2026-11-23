import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { UsersView } from '@/components/users-view';
import { toPersianDigits } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const admin = await requireAdmin();

  const [users, logs] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      include: { _count: { select: { quotations: true, customers: true } } },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
  ]);

  return (
    <UsersView
      currentUserId={admin.id}
      users={users.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        lastLoginLabel: user.lastLoginAt
          ? toPersianDigits(
              new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(
                user.lastLoginAt,
              ),
            )
          : null,
        quotationCount: user._count.quotations,
        customerCount: user._count.customers,
      }))}
      logs={logs.map((log) => ({
        id: log.id,
        actorName: log.actorName,
        action: log.action,
        summary: log.summary,
        createdAtLabel: toPersianDigits(
          new Intl.DateTimeFormat('fa-IR', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(log.createdAt),
        ),
      }))}
    />
  );
}
