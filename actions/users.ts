'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { assertAdmin, getClientIp, hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { passwordChangeSchema, userCreateSchema, userUpdateSchema } from '@/lib/validation';
import { fail, success, zodToState, type ActionState } from '@/lib/forms';

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) return fail('دسترسی غیرمجاز.');

  const parsed = userCreateSchema.safeParse({
    username: formData.get('username'),
    fullName: formData.get('fullName'),
    password: formData.get('password'),
    role: formData.get('role') ?? 'SALES',
    phone: formData.get('phone'),
  });
  if (!parsed.success) return zodToState(parsed.error);

  try {
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username.toLowerCase(),
        fullName: parsed.data.fullName,
        passwordHash: hashPassword(parsed.data.password),
        role: parsed.data.role,
        phone: parsed.data.phone ?? null,
      },
    });

    await logAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      action: 'USER_CREATE',
      entityType: 'user',
      entityId: user.id,
      summary: `ایجاد کاربر «${user.fullName}» با نقش ${user.role === 'ADMIN' ? 'مدیر سیستم' : 'کارمند فروش'}`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/users');
    return success(`کاربر «${user.fullName}» ایجاد شد.`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') return fail('این نام کاربری قبلاً ثبت شده است.');
    console.error('createUser failed', error);
    return fail('ایجاد کاربر با خطا مواجه شد.');
  }
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) return fail('دسترسی غیرمجاز.');

  const parsed = userUpdateSchema.safeParse({
    id: formData.get('id'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
    phone: formData.get('phone'),
    isActive: formData.get('isActive') === 'true',
  });
  if (!parsed.success) return zodToState(parsed.error);

  try {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return fail('کاربر یافت نشد.');

    if (target.id === admin.id && (!parsed.data.isActive || parsed.data.role !== 'ADMIN')) {
      return fail('امکان غیرفعال‌سازی یا تغییر نقش حساب خودتان وجود ندارد.');
    }

    if (target.role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
      const remainingAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: target.id } },
      });
      if (remainingAdmins === 0) return fail('حداقل یک مدیر سیستم فعال باید باقی بماند.');
    }

    if (target.role === 'ADMIN' && !parsed.data.isActive) {
      const remainingAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: target.id } },
      });
      if (remainingAdmins === 0) return fail('حداقل یک مدیر سیستم فعال باید باقی بماند.');
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        phone: parsed.data.phone ?? null,
        isActive: parsed.data.isActive,
      },
    });

    if (!updated.isActive) {
      await prisma.session.deleteMany({ where: { userId: updated.id } });
    }

    await logAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      action: 'USER_UPDATE',
      entityType: 'user',
      entityId: updated.id,
      summary: `ویرایش کاربر «${updated.fullName}» — نقش: ${updated.role === 'ADMIN' ? 'مدیر' : 'فروش'} — وضعیت: ${updated.isActive ? 'فعال' : 'غیرفعال'}`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/users');
    return success('اطلاعات کاربر ذخیره شد.');
  } catch (error) {
    console.error('updateUser failed', error);
    return fail('ویرایش کاربر با خطا مواجه شد.');
  }
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) return fail('دسترسی غیرمجاز.');

  const parsed = passwordChangeSchema.safeParse({
    id: formData.get('id'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return zodToState(parsed.error);

  try {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return fail('کاربر یافت نشد.');

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: hashPassword(parsed.data.password) },
    });

    // خروج از همه دستگاه‌های کاربر (به‌جز جلسه فعلی مدیر)
    await prisma.session.deleteMany({ where: { userId: target.id } });

    await logAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      action: 'USER_PASSWORD',
      entityType: 'user',
      entityId: target.id,
      summary: `تغییر رمز عبور کاربر «${target.fullName}»`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/users');
    return success('رمز عبور تغییر کرد و جلسه‌های کاربر باطل شد.');
  } catch (error) {
    console.error('changePassword failed', error);
    return fail('تغییر رمز عبور با خطا مواجه شد.');
  }
}
