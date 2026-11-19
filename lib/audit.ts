import { prisma } from '@/lib/db';

export interface AuditInput {
  actorId?: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  ipAddress?: string | null;
}

/** ثبت فعالیت‌های مهم در Audit Log — خطای ثبت نباید عملیات اصلی را متوقف کند. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 500),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error('audit log failed', error);
  }
}
