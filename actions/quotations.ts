'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, type QuotationStatus, type UnitType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getClientIp, requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { quotationSchema, statusChangeSchema } from '@/lib/validation';
import { fail, success, zodToState, type ActionState } from '@/lib/forms';
import { computeTotals, dec, roundMoney, roundQty } from '@/lib/money';
import { addDays, parseJalaliInput } from '@/lib/jalali';
import { getCompanySettings } from '@/lib/settings';
import { nextQuotationNumber } from '@/lib/numbering';
import { STATUS_LABEL } from '@/lib/labels';

/** وزن ردیف بر اساس واحد اندازه‌گیری */
function itemWeightKg(quantity: Prisma.Decimal, unit: UnitType, weightPerUnitKg: number) {
  if (unit === 'KILOGRAM') return quantity;
  if (unit === 'TON') return quantity.mul(1000);
  return quantity.mul(dec(weightPerUnitKg));
}

const LOCKED_STATUSES: QuotationStatus[] = ['APPROVED', 'CANCELLED'];

export async function saveQuotationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    return fail('اطلاعات فرم معتبر نیست.');
  }

  const parsed = quotationSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);

  const data = parsed.data;
  const issueDate = parseJalaliInput(data.issueDate);
  if (!issueDate) return fail('تاریخ صدور معتبر نیست.');

  const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
  if (!customer) return fail('مشتری انتخاب‌شده یافت نشد.');

  const company = await getCompanySettings();

  // محاسبه مجدد همه مبالغ در سمت سرور — مقادیر ارسالی کلاینت معتبر نیستند
  const totals = computeTotals({
    items: data.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
    includeVat: data.includeVat,
    vatRate: data.vatRate,
    transportCost: data.transportCost,
    discountAmount: data.discountAmount,
  });

  const validUntil = addDays(issueDate, data.validDays);

  let totalWeight = new Prisma.Decimal(0);
  const items = data.items.map((item, index) => {
    const quantity = roundQty(dec(item.quantity));
    const unitPrice = dec(item.unitPrice);
    const lineTotal = roundMoney(quantity.mul(unitPrice));
    const weight = roundQty(itemWeightKg(quantity, item.unit, item.weightKg));
    totalWeight = totalWeight.add(weight);
    return {
      rowIndex: index + 1,
      productId: item.productId ?? null,
      sku: item.sku ?? null,
      productName: item.productName,
      specs: item.specs ?? null,
      size: item.size ?? null,
      unit: item.unit,
      quantity,
      unitPrice,
      lineTotal,
      weightKg: weight,
    };
  });

  try {
    const quotationId = await prisma.$transaction(async (tx) => {
      const header = {
        issueDate,
        validUntil,
        validDays: data.validDays,
        status: data.status,
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerCompany: customer.companyOrProject,
        customerAddress: customer.address,
        currency: data.currency,
        includeVat: data.includeVat,
        vatRate: totals.vatRate,
        itemsSubtotal: totals.itemsSubtotal,
        transportCost: totals.transportCost,
        discountAmount: totals.discountAmount,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        totalWeightKg: totalWeight,
        itemCount: totals.itemCount,
        paymentTerms: data.paymentTerms ?? company.defaultPaymentTerms,
        deliveryTerms: data.deliveryTerms ?? company.defaultDeliveryTerms,
        notes: data.notes ?? null,
      };

      if (data.id) {
        const existing = await tx.quotation.findUnique({
          where: { id: data.id },
          include: { _count: { select: { items: true } } },
        });
        if (!existing) throw new Error('NOT_FOUND');

        const isOwner = existing.createdById === user.id;
        const isAdmin = user.role === 'ADMIN';

        if (!isAdmin && !isOwner) throw new Error('FORBIDDEN');
        if (!isAdmin && LOCKED_STATUSES.includes(existing.status)) throw new Error('LOCKED');

        await tx.quotationItem.deleteMany({ where: { quotationId: existing.id } });
        await tx.quotation.update({
          where: { id: existing.id },
          data: {
            ...header,
            items: { create: items },
          },
        });

        if (existing.status !== data.status) {
          await tx.quotationStatusHistory.create({
            data: {
              quotationId: existing.id,
              fromStatus: existing.status,
              toStatus: data.status,
              note: 'تغییر وضعیت همراه با ویرایش سند',
              changedById: user.id,
            },
          });
        }

        return { id: existing.id, number: existing.number, created: false };
      }

      const number = await nextQuotationNumber(tx, company.numberPrefix || 'AG');
      const created = await tx.quotation.create({
        data: {
          ...header,
          number,
          createdById: user.id,
          items: { create: items },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: data.status,
              note: 'صدور پیش‌فاکتور',
              changedById: user.id,
            },
          },
        },
      });

      return { id: created.id, number: created.number, created: true };
    });

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: quotationId.created ? 'QUOTATION_CREATE' : 'QUOTATION_UPDATE',
      entityType: 'quotation',
      entityId: quotationId.id,
      summary: `${quotationId.created ? 'صدور' : 'ویرایش'} پیش‌فاکتور ${quotationId.number} برای «${customer.name}» — مبلغ ${totals.grandTotal.toString()}`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/invoices');
    revalidatePath('/dashboard');
    revalidatePath(`/invoices/${quotationId.id}`);

    return {
      ok: true,
      message: quotationId.created
        ? `پیش‌فاکتور ${quotationId.number} صادر شد.`
        : 'تغییرات پیش‌فاکتور ذخیره شد.',
      data: quotationId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return fail('پیش‌فاکتور مورد نظر یافت نشد.');
    if (message === 'FORBIDDEN') return fail('شما مجاز به ویرایش این پیش‌فاکتور نیستید.');
    if (message === 'LOCKED')
      return fail('پیش‌فاکتور تأییدشده یا لغوشده قابل ویرایش نیست. با مدیر سیستم تماس بگیرید.');
    console.error('saveQuotation failed', error);
    return fail('ذخیره پیش‌فاکتور با خطا مواجه شد.');
  }
}

export async function changeQuotationStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = statusChangeSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
    note: formData.get('note'),
  });
  if (!parsed.success) return zodToState(parsed.error);

  try {
    const quotation = await prisma.quotation.findUnique({ where: { id: parsed.data.id } });
    if (!quotation) return fail('پیش‌فاکتور یافت نشد.');

    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && quotation.createdById !== user.id) {
      return fail('شما مجاز به تغییر وضعیت این پیش‌فاکتور نیستید.');
    }

    if (quotation.status === parsed.data.status) {
      return fail('وضعیت انتخاب‌شده با وضعیت فعلی یکسان است.');
    }

    await prisma.$transaction([
      prisma.quotation.update({
        where: { id: quotation.id },
        data: { status: parsed.data.status },
      }),
      prisma.quotationStatusHistory.create({
        data: {
          quotationId: quotation.id,
          fromStatus: quotation.status,
          toStatus: parsed.data.status,
          note: parsed.data.note ?? null,
          changedById: user.id,
        },
      }),
    ]);

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'QUOTATION_STATUS',
      entityType: 'quotation',
      entityId: quotation.id,
      summary: `تغییر وضعیت پیش‌فاکتور ${quotation.number} از «${STATUS_LABEL[quotation.status]}» به «${STATUS_LABEL[parsed.data.status]}»`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${quotation.id}`);
    revalidatePath('/dashboard');
    return success('وضعیت پیش‌فاکتور به‌روزرسانی شد.');
  } catch (error) {
    console.error('changeQuotationStatus failed', error);
    return fail('تغییر وضعیت با خطا مواجه شد.');
  }
}

export async function deleteQuotationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') return fail('حذف پیش‌فاکتور فقط توسط مدیر سیستم امکان‌پذیر است.');

  const id = String(formData.get('id') ?? '');
  if (!id) return fail('شناسه پیش‌فاکتور نامعتبر است.');

  try {
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return fail('پیش‌فاکتور یافت نشد.');

    await prisma.quotation.delete({ where: { id } });

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'QUOTATION_DELETE',
      entityType: 'quotation',
      entityId: id,
      summary: `حذف پیش‌فاکتور ${quotation.number} (${quotation.customerName})`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/invoices');
    revalidatePath('/dashboard');
    return success('پیش‌فاکتور حذف شد.');
  } catch (error) {
    console.error('deleteQuotation failed', error);
    return fail('حذف پیش‌فاکتور با خطا مواجه شد.');
  }
}

export async function duplicateQuotationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('شناسه پیش‌فاکتور نامعتبر است.');

  try {
    const source = await prisma.quotation.findUnique({
      where: { id },
      include: { items: { orderBy: { rowIndex: 'asc' } } },
    });
    if (!source) return fail('پیش‌فاکتور یافت نشد.');

    const company = await getCompanySettings();
    const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));

    const created = await prisma.$transaction(async (tx) => {
      const number = await nextQuotationNumber(tx, company.numberPrefix || 'AG');
      return tx.quotation.create({
        data: {
          number,
          issueDate: today,
          validUntil: addDays(today, company.defaultValidDays),
          validDays: company.defaultValidDays,
          status: 'DRAFT',
          customerId: source.customerId,
          customerName: source.customerName,
          customerMobile: source.customerMobile,
          customerCompany: source.customerCompany,
          customerAddress: source.customerAddress,
          currency: source.currency,
          includeVat: source.includeVat,
          vatRate: source.vatRate,
          itemsSubtotal: source.itemsSubtotal,
          transportCost: source.transportCost,
          discountAmount: source.discountAmount,
          vatAmount: source.vatAmount,
          grandTotal: source.grandTotal,
          totalWeightKg: source.totalWeightKg,
          itemCount: source.itemCount,
          paymentTerms: source.paymentTerms,
          deliveryTerms: source.deliveryTerms,
          notes: source.notes,
          createdById: user.id,
          items: {
            create: source.items.map((item) => ({
              rowIndex: item.rowIndex,
              productId: item.productId,
              sku: item.sku,
              productName: item.productName,
              specs: item.specs,
              size: item.size,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              weightKg: item.weightKg,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: 'DRAFT',
              note: `کپی از پیش‌فاکتور ${source.number}`,
              changedById: user.id,
            },
          },
        },
      });
    });

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'QUOTATION_DUPLICATE',
      entityType: 'quotation',
      entityId: created.id,
      summary: `کپی پیش‌فاکتور ${source.number} به شماره ${created.number}`,
      ipAddress: await getClientIp(),
    });

    revalidatePath('/invoices');
    revalidatePath('/dashboard');
    return { ok: true, message: `پیش‌فاکتور ${created.number} از سند قبلی ساخته شد.`, data: { id: created.id } };
  } catch (error) {
    console.error('duplicateQuotation failed', error);
    return fail('کپی پیش‌فاکتور با خطا مواجه شد.');
  }
}
