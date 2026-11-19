'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { assertAdmin, getClientIp } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { companySettingsSchema } from '@/lib/validation';
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

export async function saveCompanySettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) return fail('دسترسی غیرمجاز.');

  const logoValue = String(formData.get('logoDataUrl') ?? '');
  const removeLogo = formData.get('removeLogo') === 'true';

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
  });

  if (!parsed.success) return zodToState(parsed.error);

  try {
    const logo = validateLogo(parsed.data.logoDataUrl);

    await prisma.companySettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...parsed.data,
        logoDataUrl: logo,
        defaultVatRate: dec(parsed.data.defaultVatRate),
      },
      update: {
        ...parsed.data,
        logoDataUrl: removeLogo ? null : logo ?? undefined,
        defaultVatRate: dec(parsed.data.defaultVatRate),
      },
    });

    await logAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      action: 'SETTINGS_UPDATE',
      entityType: 'settings',
      entityId: '1',
      summary: 'به‌روزرسانی تنظیمات شرکت',
      ipAddress: await getClientIp(),
    });

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return success('تنظیمات شرکت ذخیره شد.');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'LOGO_TYPE') return fail('فرمت لوگو باید PNG، JPG، WEBP یا GIF باشد.');
    if (message === 'LOGO_SIZE') return fail('حجم لوگو نباید بیش از حدود ۹۰۰ کیلوبایت باشد.');
    console.error('saveCompanySettings failed', error);
    return fail('ذخیره تنظیمات با خطا مواجه شد.');
  }
}
