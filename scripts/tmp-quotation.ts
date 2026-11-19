import { PrismaClient } from '@prisma/client';
import { computeTotals, dec } from '../lib/money';
import { nextQuotationNumber } from '../lib/numbering';
import { jalaliToDate } from '../lib/jalali';

async function main() {
  const prisma = new PrismaClient();
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
  const customer = await prisma.customer.findFirstOrThrow({ where: { mobile: '09120000000' } });
  const products = await prisma.product.findMany({ take: 2, orderBy: { sku: 'asc' } });

  const items = products.map((product, index) => {
    const quantity = dec(index === 0 ? 3 : 12);
    const unitPrice = product.unitPrice;
    return {
      rowIndex: index + 1,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      specs: product.specs,
      size: product.size,
      unit: product.unit,
      quantity,
      unitPrice,
      lineTotal: quantity.mul(unitPrice).toDecimalPlaces(0),
      weightKg: dec(product.weightPerUnitKg),
    };
  });

  const totals = computeTotals({ items, includeVat: true, vatRate: 10, transportCost: 450000, discountAmount: 100000 });

  const quotation = await prisma.$transaction(async (tx) => {
    const number = await nextQuotationNumber(tx, 'AG');
    return tx.quotation.create({
      data: {
        number,
        issueDate: jalaliToDate(1405, 8, 28),
        validUntil: jalaliToDate(1405, 9, 5),
        validDays: 7,
        status: 'SENT',
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerCompany: customer.companyOrProject,
        customerAddress: customer.address,
        currency: 'TOMAN',
        includeVat: true,
        vatRate: totals.vatRate,
        itemsSubtotal: totals.itemsSubtotal,
        transportCost: totals.transportCost,
        discountAmount: totals.discountAmount,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        itemCount: items.length,
        paymentTerms: '۵۰٪ پیش‌پرداخت و مابقی هنگام تحویل کالا',
        deliveryTerms: 'تحویل در محل کارخانه فروشنده',
        notes: 'سند آزمایشی برای بررسی خروجی PDF',
        createdById: admin.id,
        items: { create: items },
        statusHistory: { create: { toStatus: 'SENT', changedById: admin.id, note: 'صدور سند آزمایشی' } },
      },
    });
  });

  console.log(JSON.stringify({ id: quotation.id, number: quotation.number, grandTotal: quotation.grandTotal.toString() }));
  await prisma.$disconnect();
}

main().catch((error) => { console.error(String(error).slice(0, 600)); process.exit(1); });
