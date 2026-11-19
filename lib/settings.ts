import { cache } from 'react';
import { prisma } from '@/lib/db';
import type { CompanySettings, Prisma } from '@prisma/client';

export const getCompanySettings = cache(async (): Promise<CompanySettings> => {
  const existing = await prisma.companySettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.companySettings.create({ data: { id: 1 } });
});

export type CompanySettingsInput = Partial<
  Omit<CompanySettings, 'id' | 'updatedAt' | 'defaultVatRate'>
> & { defaultVatRate?: Prisma.Decimal | string | number };
