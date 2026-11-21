import { z } from 'zod';
import { isValidJalali } from '@/lib/jalali';
import { normalizeNumberString, toEnglishDigits } from '@/lib/format';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** ورودی عددی ممکن است ارقام فارسی، ممیز عربی یا جداکننده هزارگان داشته باشد. */
const faNumber = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? normalizeNumberString(value) : value),
    schema,
  );

export const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const requiredText = (label: string, max: number) =>
  z
    .string({ required_error: `${label} الزامی است.` })
    .trim()
    .min(1, `${label} الزامی است.`)
    .max(max, `${label} بیش از حد طولانی است.`);

export const mobileSchema = z
  .string({ required_error: 'شماره موبایل الزامی است.' })
  .trim()
  .min(4, 'شماره موبایل معتبر نیست.')
  .max(20, 'شماره موبایل معتبر نیست.')
  .regex(/^[\d+\-() \u06F0-\u06F9]+$/, 'شماره موبایل فقط می‌تواند شامل رقم و علامت باشد.');

export const usernameSchema = z
  .string({ required_error: 'نام کاربری الزامی است.' })
  .trim()
  .min(3, 'نام کاربری حداقل ۳ کاراکتر است.')
  .max(40, 'نام کاربری حداکثر ۴۰ کاراکتر است.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'نام کاربری فقط شامل حروف انگلیسی، رقم، نقطه، خط تیره و زیرخط است.');

export const passwordSchema = z
  .string({ required_error: 'رمز عبور الزامی است.' })
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد.')
  .max(72, 'رمز عبور بیش از حد طولانی است.');

export const customerSchema = z.object({
  id: z.string().optional(),
  name: requiredText('نام مشتری', 120),
  mobile: mobileSchema,
  secondaryPhone: optionalText(40),
  companyOrProject: optionalText(160),
  customerType: z.enum(['INDIVIDUAL', 'COMPANY']).default('INDIVIDUAL'),
  nationalId: optionalText(30),
  economicCode: optionalText(30),
  city: optionalText(80),
  address: optionalText(400),
  notes: optionalText(800),
});

export const productSchema = z.object({
  id: z.string().optional(),
  sku: requiredText('کد کالا', 60),
  name: requiredText('نام کالا', 160),
  categoryId: z.preprocess(emptyToUndefined, z.string().optional()),
  factory: optionalText(120),
  specs: optionalText(400),
  size: optionalText(80),
  thickness: optionalText(80),
  length: optionalText(80),
  unit: z.enum(['KILOGRAM', 'BRANCH', 'METER', 'SHEET', 'TON']),
  weightPerUnitKg: faNumber(
    z.coerce.number().min(0, 'وزن نمی‌تواند منفی باشد.').max(1_000_000),
  ).default(0),
  unitPrice: faNumber(z.coerce.number().min(0, 'قیمت نمی‌تواند منفی باشد.').max(1e15)).default(0),
  description: optionalText(600),
  isActive: z.coerce.boolean().default(true),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: requiredText('نام دسته‌بندی', 80),
  sortOrder: faNumber(z.coerce.number().int().min(0).max(999)).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const quotationItemSchema = z.object({
  rowIndex: faNumber(z.coerce.number().int().min(1).max(500)),
  productId: z.preprocess(emptyToUndefined, z.string().optional()),
  sku: optionalText(60),
  productName: requiredText('نام کالا در ردیف', 160),
  specs: optionalText(400),
  size: optionalText(80),
  unit: z.enum(['KILOGRAM', 'BRANCH', 'METER', 'SHEET', 'TON']),
  quantity: faNumber(z.coerce.number().gt(0, 'مقدار باید بزرگ‌تر از صفر باشد.').max(1e9)),
  unitPrice: faNumber(z.coerce.number().min(0, 'قیمت واحد نامعتبر است.').max(1e15)),
  weightKg: faNumber(z.coerce.number().min(0).max(1e9)).default(0),
});

export const quotationSchema = z.object({
  id: z.string().optional(),
  customerId: requiredText('مشتری', 40),
  issueDate: z.string().min(1, 'تاریخ صدور الزامی است.'),
  validDays: faNumber(
    z.coerce.number().int().min(0, 'مدت اعتبار معتبر نیست.').max(365, 'حداکثر ۳۶۵ روز'),
  ),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'CANCELLED', 'EXPIRED']).default('DRAFT'),
  currency: z.enum(['TOMAN', 'RIAL']).default('TOMAN'),
  includeVat: z.coerce.boolean().default(false),
  vatRate: faNumber(z.coerce.number().min(0).max(100, 'درصد مالیات معتبر نیست.')).default(0),
  transportCost: faNumber(z.coerce.number().min(0).max(1e15)).default(0),
  discountAmount: faNumber(z.coerce.number().min(0).max(1e15)).default(0),
  paymentTerms: optionalText(600),
  deliveryTerms: optionalText(600),
  notes: optionalText(1000),
  items: z.array(quotationItemSchema).min(1, 'حداقل یک ردیف کالا لازم است.').max(200),
}).refine(
  (data) => {
    const [jy, jm, jd] = toEnglishDigits(data.issueDate)
      .replace(/[-.]/g, '/')
      .split('/')
      .map((part) => Number(part));
    return isValidJalali(jy, jm, jd);
  },
  { message: 'تاریخ صدور معتبر نیست (نمونه: ۱۴۰۵/۰۸/۲۸).', path: ['issueDate'] },
);

export const companySettingsSchema = z.object({
  companyName: requiredText('نام شرکت', 160),
  subtitle: optionalText(160),
  phone: optionalText(60),
  secondaryPhone: optionalText(60),
  email: optionalText(120),
  website: optionalText(120),
  address: optionalText(400),
  nationalId: optionalText(30),
  economicCode: optionalText(30),
  registrationNo: optionalText(30),
  bankInfo: optionalText(600),
  defaultPaymentTerms: optionalText(600),
  defaultDeliveryTerms: optionalText(600),
  defaultNotes: optionalText(1000),
  disclaimerText: optionalText(1000),
  currency: z.enum(['TOMAN', 'RIAL']).default('TOMAN'),
  defaultVatRate: faNumber(z.coerce.number().min(0).max(100)).default(0),
  defaultIncludeVat: z.coerce.boolean().default(false),
  defaultValidDays: faNumber(z.coerce.number().int().min(0).max(365)).default(7),
  numberPrefix: requiredText('پیش‌شماره شماره‌گذاری', 12),
  logoDataUrl: z.preprocess(emptyToUndefined, z.string().max(4_000_000).optional()),
});

export const userCreateSchema = z.object({
  username: usernameSchema,
  fullName: requiredText('نام و نام خانوادگی', 120),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'SALES']).default('SALES'),
  phone: optionalText(40),
});

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  fullName: requiredText('نام و نام خانوادگی', 120),
  role: z.enum(['ADMIN', 'SALES']),
  phone: optionalText(40),
  isActive: z.coerce.boolean().default(true),
});

export const passwordChangeSchema = z
  .object({
    id: z.string().min(1),
    password: passwordSchema,
    confirm: z.string().min(1, 'تکرار رمز عبور الزامی است.'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'رمز عبور و تکرار آن یکسان نیستند.',
    path: ['confirm'],
  });

export const statusChangeSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'CANCELLED', 'EXPIRED']),
  note: optionalText(400),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type QuotationInput = z.infer<typeof quotationSchema>;
export type CompanySettingsFormInput = z.infer<typeof companySettingsSchema>;
