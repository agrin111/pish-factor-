import { cache } from 'react';
import { prisma } from '@/lib/db';
import type { CompanySettings, LetterheadType, Prisma } from '@prisma/client';

export const getCompanySettings = cache(async (): Promise<CompanySettings> => {
  const existing = await prisma.companySettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.companySettings.create({ data: { id: 1 } });
});

export interface ResolvedLetterhead {
  type: LetterheadType;
  companyName: string;
  subtitle: string | null;
  logoDataUrl: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  nationalId: string | null;
  economicCode: string | null;
  registrationNo: string | null;
  bankInfo: string | null;
}

export function resolveLetterhead(
  company: CompanySettings,
  type: LetterheadType = 'MAIN',
): ResolvedLetterhead {
  if (type === 'MISC') {
    return {
      type: 'MISC',
      companyName: company.miscCompanyName?.trim() || company.companyName,
      subtitle: company.miscSubtitle ?? null,
      logoDataUrl: company.miscLogoDataUrl ?? null,
      phone: company.miscPhone ?? null,
      secondaryPhone: company.miscSecondaryPhone ?? null,
      email: company.miscEmail ?? null,
      website: company.miscWebsite ?? null,
      address: company.miscAddress ?? null,
      nationalId: company.miscNationalId ?? null,
      economicCode: company.miscEconomicCode ?? null,
      registrationNo: company.miscRegistrationNo ?? null,
      bankInfo: company.miscBankInfo ?? null,
    };
  }

  return {
    type: 'MAIN',
    companyName: company.companyName,
    subtitle: company.subtitle ?? null,
    logoDataUrl: company.logoDataUrl ?? null,
    phone: company.phone ?? null,
    secondaryPhone: company.secondaryPhone ?? null,
    email: company.email ?? null,
    website: company.website ?? null,
    address: company.address ?? null,
    nationalId: company.nationalId ?? null,
    economicCode: company.economicCode ?? null,
    registrationNo: company.registrationNo ?? null,
    bankInfo: company.bankInfo ?? null,
  };
}

export type CompanySettingsInput = Partial<
  Omit<CompanySettings, 'id' | 'updatedAt' | 'defaultVatRate'>
> & { defaultVatRate?: Prisma.Decimal | string | number };
