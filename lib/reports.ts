import { prisma } from '@/lib/db';
import type { QuotationStatus, SessionUserLike } from '@/lib/types';
import { effectiveStatus } from '@/lib/quotation-status';
import { toJalali } from '@/lib/jalali';
import type { Prisma } from '@prisma/client';

const MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export interface ReportRange {
  from: Date;
  to: Date;
}

export interface ReportData {
  totalCount: number;
  totalAmount: number;
  approvedCount: number;
  approvedAmount: number;
  cancelledCount: number;
  draftCount: number;
  sentCount: number;
  expiredCount: number;
  monthly: { label: string; count: number; amount: number }[];
  customers: { name: string; mobile: string; count: number; amount: number }[];
  users: { name: string; count: number; amount: number; approved: number }[];
  documents: {
    id: string;
    number: string;
    customerName: string;
    customerMobile: string;
    issueDate: Date;
    amount: number;
    currency: 'TOMAN' | 'RIAL';
    totalWeightKg: number;
    status: QuotationStatus;
    userName: string;
  }[];
}

export interface ReportUser {
  id: string;
  role: 'ADMIN' | 'SALES';
}

export function buildReportWhere(user: ReportUser, range: ReportRange): Prisma.QuotationWhereInput {
  return {
    issueDate: { gte: range.from, lt: new Date(range.to.getTime() + 24 * 60 * 60 * 1000) },
    ...(user.role === 'SALES' ? { createdById: user.id } : {}),
  };
}

export async function loadReport(user: ReportUser, range: ReportRange): Promise<ReportData> {
  const quotations = await prisma.quotation.findMany({
    where: buildReportWhere(user, range),
    orderBy: { issueDate: 'desc' },
    include: { createdBy: { select: { fullName: true } } },
  });

  const monthlyMap = new Map<string, { label: string; count: number; amount: number; sort: number }>();
  const customerMap = new Map<string, { name: string; mobile: string; count: number; amount: number }>();
  const userMap = new Map<string, { name: string; count: number; amount: number; approved: number }>();

  let totalCount = 0;
  let totalAmount = 0;
  let approvedCount = 0;
  let approvedAmount = 0;
  let cancelledCount = 0;
  let draftCount = 0;
  let sentCount = 0;
  let expiredCount = 0;

  for (const quotation of quotations) {
    const status = effectiveStatus(quotation);
    const amount = Number(quotation.grandTotal.toString());
    const counted = status !== 'CANCELLED';

    if (counted) {
      totalCount += 1;
      totalAmount += amount;
    }

    if (status === 'APPROVED') {
      approvedCount += 1;
      approvedAmount += amount;
    } else if (status === 'CANCELLED') {
      cancelledCount += 1;
    } else if (status === 'DRAFT') {
      draftCount += 1;
    } else if (status === 'EXPIRED') {
      expiredCount += 1;
    } else {
      sentCount += 1;
    }

    if (status !== 'CANCELLED') {
      const jalali = toJalali(quotation.issueDate);
      const key = `${jalali.jy}-${jalali.jm}`;
      const bucket = monthlyMap.get(key) ?? {
        label: `${MONTHS[jalali.jm - 1]} ${jalali.jy}`,
        count: 0,
        amount: 0,
        sort: jalali.jy * 12 + jalali.jm,
      };
      bucket.count += 1;
      bucket.amount += amount;
      monthlyMap.set(key, bucket);

      const customerKey = quotation.customerId;
      const customerBucket = customerMap.get(customerKey) ?? {
        name: quotation.customerName,
        mobile: quotation.customerMobile,
        count: 0,
        amount: 0,
      };
      customerBucket.count += 1;
      customerBucket.amount += amount;
      customerMap.set(customerKey, customerBucket);

      const userName = quotation.createdBy.fullName;
      const userBucket = userMap.get(userName) ?? { name: userName, count: 0, amount: 0, approved: 0 };
      userBucket.count += 1;
      userBucket.amount += amount;
      if (status === 'APPROVED') userBucket.approved += 1;
      userMap.set(userName, userBucket);
    }
  }

  return {
    totalCount,
    totalAmount,
    approvedCount,
    approvedAmount,
    cancelledCount,
    draftCount,
    sentCount,
    expiredCount,
    monthly: [...monthlyMap.values()].sort((a, b) => b.sort - a.sort).map(({ label, count, amount }) => ({ label, count, amount })),
    customers: [...customerMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
    users: [...userMap.values()].sort((a, b) => b.amount - a.amount),
    documents: quotations.map((quotation) => ({
      id: quotation.id,
      number: quotation.number,
      customerName: quotation.customerName,
      customerMobile: quotation.customerMobile,
      issueDate: quotation.issueDate,
      amount: Number(quotation.grandTotal.toString()),
      currency: quotation.currency,
      totalWeightKg: Number(quotation.totalWeightKg?.toString() ?? '0'),
      status: effectiveStatus(quotation),
      userName: quotation.createdBy.fullName,
    })),
  };
}
