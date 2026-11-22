import { prisma } from '@/lib/db';
import { getClientIp, getSessionUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { formatJalali } from '@/lib/jalali';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * خروجی JSON کامل داده‌های عملیاتی برای نگهداری در فضای امن خارج از سرور.
 * رمز عبور کاربران، نشست‌ها و رمز SMTP هرگز در خروجی قرار نمی‌گیرند.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    return new Response('دسترسی غیرمجاز', { status: 403 });
  }

  const [rawSettings, categories, products, customers, quotations, audits, users] =
    await Promise.all([
      prisma.companySettings.findUnique({ where: { id: 1 } }),
      prisma.productCategory.findMany(),
      prisma.product.findMany(),
      prisma.customer.findMany(),
      prisma.quotation.findMany({
        include: { items: true, statusHistory: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          isActive: true,
          phone: true,
          createdAt: true,
        },
      }),
    ]);

  const settings = rawSettings
    ? (() => {
        const { smtpPass, ...safeSettings } = rawSettings;
        return {
          ...safeSettings,
          hasSmtpPass: Boolean(smtpPass),
        };
      })()
    : null;

  const payload = {
    meta: {
      system: 'Aghrin PishFactor',
      exportedAt: new Date().toISOString(),
      exportedBy: user.username,
      version: 1,
    },
    settings,
    users,
    categories,
    products,
    customers,
    quotations,
    audits,
  };

  await logAudit({
    actorId: user.id,
    actorName: user.fullName,
    action: 'BACKUP_EXPORT',
    entityType: 'system',
    summary: 'دریافت نسخه پشتیبان JSON',
    ipAddress: await getClientIp(),
  });

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="pishfactor-backup-${formatJalali(new Date()).replace(/[^0-9۰-۹]/g, '')}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
