export type UserRole = 'admin' | 'sales';

export type UnitType = 'کیلوگرم' | 'شاخه' | 'متر' | 'برگ' | 'تن';

export type CustomerType = 'حقیقی' | 'حقوقی';

export type CurrencyType = 'تومان' | 'ریال';

export type QuotationStatus =
  | 'پیش‌نویس'
  | 'ارسال‌شده'
  | 'تاییدشده'
  | 'لغوشده'
  | 'منقضی‌شده';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffInvite {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductCategoryDoc {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  factory: string;
  specs?: string;
  size?: string;
  thickness?: string;
  length?: string;
  unit: UnitType;
  weightPerUnitKg: number;
  unitPrice: number;
  description?: string;
  isActive: boolean;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  secondaryPhone?: string;
  companyOrProject?: string;
  customerType: CustomerType;
  nationalId?: string;
  economicCode?: string;
  city?: string;
  address?: string;
  notes?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface QuotationItem {
  id: string;
  rowIndex: number;
  productId?: string;
  sku?: string;
  productName: string;
  specs?: string;
  size?: string;
  unit: UnitType;
  quantity: number;
  weightPerUnitKg: number;
  unitPrice: number;
  lineTotal: number;
  createdByUid?: string;
  createdAt?: unknown;
}

export interface QuotationStatusHistory {
  id: string;
  fromStatus: string;
  toStatus: QuotationStatus;
  note?: string;
  changedByUid: string;
  changedByName: string;
  changedAt?: unknown;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  issueDateShamsi: string;
  validUntilShamsi: string;
  validDays: number;
  customerId: string;
  customerName: string;
  customerMobile?: string;
  customerCompanyOrProject?: string;
  customerAddress?: string;
  status: QuotationStatus;
  currency: CurrencyType;
  includeVat: boolean;
  vatRate: number;
  itemsSubtotal: number;
  transportCost: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
  totalWeightKg: number;
  itemCount: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanySettings {
  companyName: string;
  subtitle?: string;
  logoDataUrl?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  nationalId?: string;
  economicCode?: string;
  registrationNo?: string;
  bankInfo?: string;
  defaultPaymentTerms?: string;
  defaultDeliveryTerms?: string;
  defaultNotes?: string;
  disclaimerText?: string;
  currency: CurrencyType;
  defaultVatRate: number;
  defaultIncludeVat: boolean;
  defaultValidDays: number;
  updatedByUid?: string;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorUid: string;
  actorName: string;
  createdAt?: unknown;
}

export type ActiveTab =
  | 'dashboard'
  | 'invoices'
  | 'products'
  | 'customers'
  | 'reports'
  | 'users'
  | 'settings';
