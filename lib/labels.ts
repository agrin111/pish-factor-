import type {
  Currency,
  CustomerType,
  QuotationStatus,
  Role,
  UnitType,
} from '@prisma/client';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'مدیر سیستم',
  SALES: 'کارمند فروش',
};

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: 'پیش‌نویس',
  SENT: 'ارسال‌شده / در انتظار پاسخ',
  APPROVED: 'تأییدشده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
};

export const STATUS_BADGE: Record<QuotationStatus, string> = {
  DRAFT: 'badge badge-gray',
  SENT: 'badge badge-blue',
  APPROVED: 'badge badge-green',
  CANCELLED: 'badge badge-red',
  EXPIRED: 'badge badge-amber',
};

export const UNIT_LABEL: Record<UnitType, string> = {
  KILOGRAM: 'کیلوگرم',
  BRANCH: 'شاخه',
  METER: 'متر',
  SHEET: 'برگ',
  TON: 'تن',
};

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  INDIVIDUAL: 'حقیقی',
  COMPANY: 'حقوقی',
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  TOMAN: 'تومان',
  RIAL: 'ریال',
};

export const UNITS = Object.keys(UNIT_LABEL) as UnitType[];
export const STATUSES = Object.keys(STATUS_LABEL) as QuotationStatus[];

export const PAYMENT_TERMS_SUGGESTIONS = [
  '۵۰٪ پیش‌پرداخت و مابقی هنگام تحویل',
  'نقدی هنگام تحویل',
  '۳۰٪ پیش‌پرداخت، ۷۰٪ هنگام بارگیری',
];

export const DELIVERY_TERMS_SUGGESTIONS = [
  'تحویل در محل کارخانه فروشنده',
  'ارسال به آدرس خریدار (هزینه حمل به عهده خریدار)',
  'تحویل در محل پروژه',
];
