'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { assertAdmin, getClientIp } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { companySettingsSchema, letterheadUpdateSchema } from '@/lib/validation';
import { fail, success, zodToState, type ActionState } from '@/lib/forms';
import { dec } from '@/lib/money';

const MAX_LOGO_BYTES = 900_000;

function validateLogo(dataUrl: string | undefined): string | null {
  if (!dataUrl) return null;
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(dataUrl)) {
    throw new Error('LOGO_TYPE');
  }
  const base64 = dataUrl.split(',')[1] ?? '';
  const size = Math.ceil((base64.length * 3) / 4);
  if (size > MAX_LOGO_BYTES) throw new Error('LOGO_SIZE');
  return dataUrl;
}

function revalidateAllSettingsPaths() {
  revalidatePath('/', 'layout');
  revalidatePath('/settings');
  revalidatePath('/letterhead');
  revalidatePath('/dashboard');
  revalidatePath('/products');
  revalidatePath('/invoices');
  revalidatePath('/invoices/new');
}

export async function saveCompanySettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) return fail('دسترسی غیرمجاز.');

  const logoValue = String(formData.get('logoDataUrl') ?? '');
  const removeLogo = formData.get('removeLogo') === 'true';
  const miscLogoValue = String(formData.get('miscLogoDataUrl') ?? '');
  const removeMiscLogo = formData.get('removeMiscLogo') === 'true';

  const parsed = companySettingsSchema.safeParse({
    companyName: formData.get('companyName'),
    subtitle: formData.get('subtitle'),
    phone: formData.get('phone'),
    secondaryPhone: formData.get('secondaryPhone'),
    email: formData.get('email'),
    website: formData.get('website'),
    address: formData.get('address'),
    nationalId: formData.get('nationalId'),
    economicCode: formData.get('economicCode'),
    registrationNo: formData.get('registrationNo'),
    bankInfo: formData.get('bankInfo'),
    defaultPaymentTerms: formData.get('defaultPaymentTerms'),
    defaultDeliveryTerms: formData.get('defaultDeliveryTerms'),
    defaultNotes: formData.get('defaultNotes'),
    disclaimerText: formData.get('disclaimerText'),
    currency: formData.get('currency') ?? 'TOMAN',
    defaultVatRate: formData.get('defaultVatRate') ?? 0,
    defaultIncludeVat: formData.get('defaultIncludeVat') === 'on',
    defaultValidDays: formData.get('defaultValidDays') ?? 7,
    numberPrefix: formData.get('numberPrefix'),
    logoDataUrl: logoValue || undefined,
    miscCompanyName: formData.get('miscCompanyName'),
    miscSubtitle: formData.get('miscSubtitle'),
    miscPhone: formData.get('miscPhone'),
    miscSecondaryPhone: formData.get('miscSecondaryPhone'),
    miscEmail: formData.get('miscEmail'),
    miscWebsite: formData.get('miscWebsite'),
    miscAddress: formData.get('miscAddress'),
    miscNationalId: formData.get('miscNationalId'),
    miscEconomicCode: formData.get('miscEconomicCode'),
    miscRegistrationNo: formData.get('miscRegistrationNo'),
    miscBankInfo: formData.get('miscBankInfo'),
    miscLogoDataUrl: miscLogoValue || undefined,
    smtpHost: formData.get('smtpHost'),
    smtpPort: formData.get('smtpPort'),
    smtpSecure: formData.get('smtpSecure') === 'on',
    smtpUser: formData.get('smtpUser'),
    smtpPass: formData.get('smtpPass'),
    smtpFrom: formData.get('smtpFrom'),
  });

  if (!parsed.success) return zodToState(parsed.error);

  try {
    const logo = validateLogo(parsed.data.logoDataUrl);
    const miscLogo = validateLogo(parsed.data.miscLogoDataUrl);
    const clearSmtpPass = formData.get('clearSmtpPass') === 'true';

    const payload = {
      companyName: parsed.data.companyName,
      subtitle: parsed.data.subtitle ?? null,
      phone: parsed.data.phone ?? null,
      secondaryPhone: parsed.data.secondaryPhone ?? null,
      email: parsed.data.email ?? null,
      website: parsed.data.website ?? null,
      address: parsed.data.address ?? null,
      nationalId: parsed.data.nationalId ?? null,
      economicCode: parsed.data.economicCode ?? null,
      registrationNo: parsed.data.registrationNo ?? null,
      bankInfo: parsed.data.bankInfo ?? null,
      defaultPaymentTerms: parsed.data.defaultPaymentTerms ?? null,
      defaultDeliveryTerms: parsed.data.defaultDeliveryTerms ?? null,
      defaultNotes: parsed.data.defaultNotes ?? null,
      disclaimerText: parsed.data.disclaimerText ?? null,
      currency: parsed.data.currency,
      defaultVatRate: dec(parsed.data.defaultVatRate),
      defaultIncludeVat: parsed.data.defaultIncludeVat,
      defaultValidDays: parsed.data.defaultValidDays,
      numberPrefix: parsed.data.numberPrefix,
      miscCompanyName: parsed.data.miscCompanyName ?? null,
      miscSubtitle: parsed.data.miscSubtitle ?? null,
      miscPhone: parsed.data.miscPhone ?? null,
      miscSecondaryPhone: parsed.data.miscSecondaryPhone ?? null,
      miscEmail: parsed.data.miscEmail ?? null,
      miscWebsite: parsed.data.miscWebsite ?? null,
      miscAddress: parsed.data.miscAddress ?? null,
      miscNationalId: parsed.data.miscNationalId ?? null,
      miscEconomicCode: parsed.data.miscEconomicCode ?? null,
      miscRegistrationNo: parsed.data.miscRegistrationNo ?? null,
      miscBankInfo: parsed.data.miscBankInfo ?? null,
      smtpHost: parsed.data.smtpHost ?? null,
      smtpPort: parsed.data.smtpPort ?? 587,
      smtpSecure: parsed.data.smtpSecure,
      smtpUser: parsed.data.smtpUser ?? null,
      smtpFrom: parsed.data.smtpFrom ?? null,
    };

    await prisma.companySettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...payload,
        smtpPass: clearSmtpPass ? null : parsed.data.smtpPass ?? null,
        logoDataUrl: removeLogo ? null : logo,
        miscLogoDataUrl: removeMiscLogo ? null : miscLogo,
      },
      update: {
        ...payload,
        smtpPass: clearSmtpPass ? null : parsed.data.smtpPass ?? undefined,
        logoDataUrl: removeLogo ? null : logo ?? undefined,
        miscLogoDataUrl: removeMiscLogo ? null : miscLogo ?? undefined,
      },
    });

    await logAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      action: 'SETTINGS_UPDATE',
      entityType: 'settings',
      entityId: '1',
      summary: `به‌روزرسانی تنظیمات شرکت (واحد پول: ${parsed.data.currency === 'RIAL' ? 'ریال' : 'تومان'})`,
      ipAddress: await getClientIp(),
    });

    revalidateAllSettingsPaths();
    return success('تنظیمات شرکت و سربرگ‌ها ذخیره شد.');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'LOGO_TYPE') return fail('فرمت لوگو باید PNG، JPG، WEBP یا GIF باشد.');
    if (message === 'LOGO_SIZE') return fail('حجم لوگو نباید بیش از حدود ۹۰۰ کیلوبایت باشد.');
    console.error('saveCompanySettings failed', error);
    return fail('ذخیره تنظیمات با خطا مواجه شد.');
  }
}

export async function saveLetterheadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) return fail('ویرایش اطلاعات سربرگ فقط توسط مدیر سیستم مجاز است.');

  const logoValue = String(formData.get('logoDataUrl') ?? '');
  const removeLogo = formData.get('removeLogo') === 'true';

  const parsed = letterheadUpdateSchema.safeParse({
    target: formData.get('target') ?? 'MAIN',
    companyName: formData.get('companyName'),
    subtitle: formData.get('subtitle'),
    phone: formData.get('phone'),
    secondaryPhone: formData.get('secondaryPhone'),
    email: formData.get('email'),
    website: formData.get('website'),
    address: formData.get('address'),
    nationalId: formData.get('nationalId'),
    economicCode: formData.get('economicCode'),
    registrationNo: formData.get('registrationNo'),
    bankInfo: formData.get('bankInfo'),
    logoDataUrl: logoValue || undefined,
  });

  if (!parsed.success) return zodToState(parsed.error);

  try {
    const logo = validateLogo(parsed.data.logoDataUrl);
    const isMisc = parsed.data.target === 'MISC';

    const updateData = isMisc
      ? {
          miscCompanyName: parsed.data.companyName,
          miscSubtitle: parsed.data.subtitle ?? null,
          miscPhone: parsed.data.phone ?? null,
          miscSecondaryPhone: parsed.data.secondaryPhone ?? null,
          miscEmail: parsed.data.email ?? null,
          miscWebsite: parsed.data.website ?? null,
          miscAddress: parsed.data.address ?? null,
          miscNationalId: parsed.data.nationalId ?? null,
          miscEconomicCode: parsed.data.economicCode ?? null,
          miscRegistrationNo: parsed.data.registrationNo ?? null,
          miscBankInfo: parsed.data.bankInfo ?? null,
          miscLogoDataUrl: removeLogo ? null : logo ?? undefined,
        }
      : {
          companyName: parsed.data.companyName,
          subtitle: parsed.data.subtitle ?? null,
          phone: parsed.data.phone ?? null,
          secondaryPhone: parsed.data.secondaryPhone ?? null,
          email: parsed.data.email ?? null,
          website: parsed.data.website ?? null,
          address: parsed.data.address ?? null,
          nationalId: parsed.data.nationalId ?? null,
          economicCode: parsed.data.economicCode ?? null,
          registrationNo: parsed.data.registrationNo ?? null,
          bankInfo: parsed.data.bankInfo ?? null,
          logoDataUrl: removeLogo ? null : logo ?? undefined,
        };

    await prisma.companySettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...updateData,
      },
      update: updateData,
    });

    await logAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      action: 'LETTERHEAD_UPDATE',
      entityType: 'settings',
      entityId: '1',
      summary: `ویرایش اطلاعات ${isMisc ? 'سربرگ متفرقه' : 'سربرگ اصلی شرکت'}`,
      ipAddress: await getClientIp(),
    });

    revalidateAllSettingsPaths();
    return success(
      isMisc ? 'اطلاعات سربرگ متفرقه ذخیره شد.' : 'اطلاعات سربرگ اصلی شرکت ذخیره شد.',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'LOGO_TYPE') return fail('فرمت لوگو باید PNG، JPG، WEBP یا GIF باشد.');
    if (message === 'LOGO_SIZE') return fail('حجم لوگو نباید بیش از حدود ۹۰۰ کیلوبایت باشد.');
    console.error('saveLetterhead failed', error);
    return fail('ذخیره اطلاعات سربرگ با خطا مواجه شد.');
  }
}
