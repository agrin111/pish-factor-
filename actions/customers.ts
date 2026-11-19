'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getClientIp, requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { customerSchema } from '@/lib/validation';
import { fail, success, zodToState, type ActionState } from '@/lib/forms';

export async function saveCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = customerSchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    name: formData.get('name'),
    mobile: formData.get('mobile'),
    secondaryPhone: formData.get('secondaryPhone'),
    companyOrProject: formData.get('companyOrProject'),
    customerType: formData.get('customerType') ?? 'INDIVIDUAL',
    nationalId: formData.get('nationalId'),
    economicCode: formData.get('economicCode'),
    city: formData.get('city'),
    address: formData.get('address'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) return zodToState(parsed.error);
  const data = parsed.data;

  try {
    if (data.id) {
      const existing = await prisma.customer.findUnique({ where: { id: data.id } });
      if (!existing) return fail('مشتری مورد نظر یافت نشد.');

      const updated = await prisma.customer.update({
        where: { id: data.id },
        data: {
          name: data.name,
          mobile: data.mobile,
          secondaryPhone: data.secondaryPhone ?? null,
          companyOrProject: data.companyOrProject ?? null,
          customerType: data.customerType,
          nationalId: data.nationalId ?? null,
          economicCode: data.economicCode ?? null,
          city: data.city ?? null,
          address: data.address ?? null,
          notes: data.notes ?? null,
        },
      });

      await logAudit({
        actorId: user.id,
        actorName: user.fullName,
        action: 'CUSTOMER_UPDATE',
        entityType: 'customer',
        entityId: updated.id,
        summary: `ویرایش مشتری «${updated.name}»`,
        ipAddress: await getClientIp(),
      });

      revalidatePath('/customers');
      revalidatePath('/dashboard');
      return success('اطلاعات مشتری به‌روزرسانی شد.');
    }

    const created = await prisma.customer.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        secondaryPhone: data.secondaryPhone ?? null,
        companyOrProject: data.companyOrProject ?? null,
        customerType: data.customerType,
        nationalId: data.nationalId ?? null,
        economicCode: data.economicCode ?? null,
        city: data.city ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        createdById: user.id,
      },
    });

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'CUSTOMER_CREATE',
      entityType: 'customer',
      entityId: created.id,
      summary: `ثبت مشتری جدید «${created.name}»`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard');
    return success('مشتری جدید ثبت شد.');
  } catch (error) {
    console.error('saveCustomer failed', error);
    return fail('ثبت مشتری با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
  }
}

export async function deleteCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('شناسه مشتری نامعتبر است.');

  if (user.role !== 'ADMIN') {
    return fail('حذف مشتری فقط توسط مدیر سیستم امکان‌پذیر است.');
  }

  try {
    const quotations = await prisma.quotation.count({ where: { customerId: id } });
    if (quotations > 0) {
      return fail(
        `این مشتری ${quotations} پیش‌فاکتور دارد و قابل حذف نیست. برای حفظ سوابق، اطلاعات او را ویرایش کنید.`,
      );
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return fail('مشتری مورد نظر یافت نشد.');

    await prisma.customer.delete({ where: { id } });

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'CUSTOMER_DELETE',
      entityType: 'customer',
      entityId: id,
      summary: `حذف مشتری «${customer.name}»`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard');
    return success('مشتری حذف شد.');
  } catch (error) {
    console.error('deleteCustomer failed', error);
    return fail('حذف مشتری با خطا مواجه شد.');
  }
}
