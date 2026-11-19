'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { assertAdmin, getClientIp, requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { categorySchema, productSchema } from '@/lib/validation';
import { fail, success, zodToState, type ActionState } from '@/lib/forms';
import { dec } from '@/lib/money';

export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    return fail('مدیریت کالاها فقط توسط مدیر سیستم امکان‌پذیر است.');
  }

  const parsed = productSchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    sku: formData.get('sku'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    factory: formData.get('factory'),
    specs: formData.get('specs'),
    size: formData.get('size'),
    thickness: formData.get('thickness'),
    length: formData.get('length'),
    unit: formData.get('unit'),
    weightPerUnitKg: formData.get('weightPerUnitKg') ?? 0,
    unitPrice: formData.get('unitPrice') ?? 0,
    description: formData.get('description'),
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  });

  if (!parsed.success) return zodToState(parsed.error);
  const data = parsed.data;

  try {
    const payload = {
      sku: data.sku,
      name: data.name,
      categoryId: data.categoryId ?? null,
      factory: data.factory ?? null,
      specs: data.specs ?? null,
      size: data.size ?? null,
      thickness: data.thickness ?? null,
      length: data.length ?? null,
      unit: data.unit,
      weightPerUnitKg: dec(data.weightPerUnitKg),
      unitPrice: dec(data.unitPrice),
      description: data.description ?? null,
      isActive: data.isActive,
    };

    if (data.id) {
      const updated = await prisma.product.update({ where: { id: data.id }, data: payload });
      await logAudit({
        actorId: user.id,
        actorName: user.fullName,
        action: 'PRODUCT_UPDATE',
        entityType: 'product',
        entityId: updated.id,
        summary: `ویرایش کالا «${updated.name}» (${updated.sku})`,
        ipAddress: await getClientIp(),
      });
    } else {
      const created = await prisma.product.create({ data: payload });
      await logAudit({
        actorId: user.id,
        actorName: user.fullName,
        action: 'PRODUCT_CREATE',
        entityType: 'product',
        entityId: created.id,
        summary: `ثبت کالای جدید «${created.name}» (${created.sku})`,
        ipAddress: await getClientIp(),
      });
    }

    revalidatePath('/products');
    revalidatePath('/dashboard');
    return success('اطلاعات کالا ذخیره شد.');
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') return fail('کد کالا تکراری است. کد دیگری انتخاب کنید.');
    console.error('saveProduct failed', error);
    return fail('ذخیره کالا با خطا مواجه شد.');
  }
}

export async function updateProductPriceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') return fail('تغییر قیمت فقط توسط مدیر سیستم امکان‌پذیر است.');

  const id = String(formData.get('id') ?? '');
  const price = Number(formData.get('unitPrice'));
  if (!id || !Number.isFinite(price) || price < 0) return fail('قیمت وارد شده معتبر نیست.');

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { unitPrice: dec(price) },
    });
    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'PRODUCT_PRICE_UPDATE',
      entityType: 'product',
      entityId: product.id,
      summary: `به‌روزرسانی قیمت «${product.name}» به ${price}`,
      ipAddress: await getClientIp(),
    });
    revalidatePath('/products');
    return success('قیمت کالا به‌روزرسانی شد.');
  } catch (error) {
    console.error('updateProductPrice failed', error);
    return fail('به‌روزرسانی قیمت با خطا مواجه شد.');
  }
}

export async function toggleProductActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertAdmin().catch(() => null);
  if (!user) return fail('دسترسی غیرمجاز.');

  const id = String(formData.get('id') ?? '');
  const isActive = formData.get('isActive') === 'true';

  try {
    await prisma.product.update({ where: { id }, data: { isActive } });
    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'PRODUCT_STATUS',
      entityType: 'product',
      entityId: id,
      summary: `${isActive ? 'فعال‌سازی' : 'غیرفعال‌سازی'} کالا`,
      ipAddress: await getClientIp(),
    });
    revalidatePath('/products');
    return success(isActive ? 'کالا فعال شد.' : 'کالا غیرفعال شد.');
  } catch (error) {
    console.error('toggleProductActive failed', error);
    return fail('تغییر وضعیت کالا با خطا مواجه شد.');
  }
}

export async function deleteProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertAdmin().catch(() => null);
  if (!user) return fail('دسترسی غیرمجاز.');

  const id = String(formData.get('id') ?? '');

  try {
    const used = await prisma.quotationItem.count({ where: { productId: id } });
    if (used > 0) {
      return fail(
        'این کالا در پیش‌فاکتورها استفاده شده است و قابل حذف نیست. آن را غیرفعال کنید.',
      );
    }
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return fail('کالا یافت نشد.');
    await prisma.product.delete({ where: { id } });
    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'PRODUCT_DELETE',
      entityType: 'product',
      entityId: id,
      summary: `حذف کالا «${product.name}»`,
      ipAddress: await getClientIp(),
    });
    revalidatePath('/products');
    return success('کالا حذف شد.');
  } catch (error) {
    console.error('deleteProduct failed', error);
    return fail('حذف کالا با خطا مواجه شد.');
  }
}

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') return fail('مدیریت دسته‌بندی فقط توسط مدیر سیستم امکان‌پذیر است.');

  const parsed = categorySchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    name: formData.get('name'),
    sortOrder: formData.get('sortOrder') ?? 0,
    isActive: formData.get('isActive') !== 'false',
  });

  if (!parsed.success) return zodToState(parsed.error);

  try {
    if (parsed.data.id) {
      await prisma.productCategory.update({
        where: { id: parsed.data.id },
        data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
      });
    } else {
      await prisma.productCategory.create({
        data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
      });
    }
    revalidatePath('/products');
    return success('دسته‌بندی ذخیره شد.');
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') return fail('این نام دسته‌بندی قبلاً ثبت شده است.');
    console.error('saveCategory failed', error);
    return fail('ذخیره دسته‌بندی با خطا مواجه شد.');
  }
}
