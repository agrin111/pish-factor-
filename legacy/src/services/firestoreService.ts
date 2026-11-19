import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AuditLog,
  CompanySettings,
  Customer,
  Product,
  ProductCategoryDoc,
  Quotation,
  QuotationItem,
  QuotationStatus,
  QuotationStatusHistory,
  StaffInvite,
  UserProfile,
} from '../types';
import {
  addDaysShamsi,
  calculateQuotationTotals,
  generateSafeId,
  getShamsiDate,
  sanitizeStr,
} from '../utils/formatters';

export const BOOTSTRAP_ADMIN_EMAIL = 'agrin.sazan@gmail.com';

export const defaultCompanySettings: CompanySettings = {
  companyName: 'شرکت آهن آگرین',
  subtitle: 'سامانه تخصصی صدور پیش‌فاکتور و فروش مقاطع فولادی',
  logoDataUrl: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  nationalId: '',
  economicCode: '',
  registrationNo: '',
  bankInfo: '',
  defaultPaymentTerms: 'نقدی پیش از صدور حواله بارگیری (یا طبق توافق کتبی مدیریت فروش)',
  defaultDeliveryTerms: 'تحویل روی باسکول مبدا / هزینه حمل و تخلیه به عهده خریدار',
  defaultNotes: 'باسکول مبدا ملاک وزن تحویلی می‌باشد.',
  disclaimerText:
    'با توجه به نوسانات روزانه بازار آهن‌آلات، اعتبار قیمت‌های مندرج در این پیش‌فاکتور محدود به تاریخ اعتبار قیدشده است و صدور پیش‌فاکتور به منزله رزرو قطعی کالا تا پیش از واریز وجه نمی‌باشد.',
  currency: 'تومان',
  defaultVatRate: 10,
  defaultIncludeVat: true,
  defaultValidDays: 2,
};

export async function recordAuditLog(
  actor: Pick<UserProfile, 'uid' | 'displayName'>,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
) {
  const id = generateSafeId('log');
  try {
    await setDoc(doc(db, 'audit_logs', id), {
      action: sanitizeStr(action, 80) || 'OPERATION',
      entityType: sanitizeStr(entityType, 60) || 'system',
      entityId: sanitizeStr(entityId, 128) || 'unknown',
      summary: sanitizeStr(summary, 400) || '-',
      actorUid: actor.uid,
      actorName: sanitizeStr(actor.displayName, 120) || 'کاربر',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${id}`);
  }
}

export async function syncUserProfile(firebaseUser: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const email = (firebaseUser.email || '').toLowerCase();
  const isBootstrapAdmin = email === BOOTSTRAP_ADMIN_EMAIL;

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as Omit<UserProfile, 'id'>;
      return { id: snap.id, ...data };
    }

    // Check if an admin invited this email
    let invitedDisplayName = '';
    try {
      const inviteQ = query(
        collection(db, 'staff_invites'),
        where('email', '==', email),
        limit(1)
      );
      const inviteSnap = await getDocs(inviteQ);
      if (!inviteSnap.empty) {
        const inv = inviteSnap.docs[0].data() as StaffInvite;
        invitedDisplayName = inv.displayName;
      }
    } catch {
      // Non-fatal if invite check fails
    }

    const displayName =
      sanitizeStr(invitedDisplayName || firebaseUser.displayName || email.split('@')[0], 120) ||
      'کاربر فروش';

    const newProfile = {
      uid: firebaseUser.uid,
      email,
      displayName,
      role: isBootstrapAdmin ? ('admin' as const) : ('sales' as const),
      isActive: true,
      phone: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    return { id: firebaseUser.uid, ...newProfile };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
  }
}

export async function seedWorkspaceDefaults(user: UserProfile) {
  if (user.role !== 'admin') return;

  try {
    const settingsRef = doc(db, 'company_settings', 'main');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        ...defaultCompanySettings,
        updatedByUid: user.uid,
        updatedAt: serverTimestamp(),
      });
    }

    const catSnap = await getDocs(query(collection(db, 'product_categories'), limit(1)));
    if (catSnap.empty) {
      const defaultCats = [
        { id: 'cat_rebar', name: 'میلگرد', description: 'میلگردهای آجدار و ساده ساختمانی', sortOrder: 1 },
        { id: 'cat_beam', name: 'تیرآهن', description: 'تیرآهن‌های IPE و هاش', sortOrder: 2 },
        { id: 'cat_sheet', name: 'ورق', description: 'ورق سیاه، گالوانیزه و روغنی', sortOrder: 3 },
        { id: 'cat_profile', name: 'پروفیل و قوطی', description: 'انواع قوطی و پروفیل صنعتی و ساختمانی', sortOrder: 4 },
        { id: 'cat_angle', name: 'نبشی و ناودانی', description: 'نبشی و ناودانی بال مساوی و نامساوی', sortOrder: 5 },
        { id: 'cat_pipe', name: 'لوله', description: 'لوله‌های داربستی، صنعتی و گازی', sortOrder: 6 },
      ];
      const batch = writeBatch(db);
      for (const c of defaultCats) {
        batch.set(doc(db, 'product_categories', c.id), {
          name: c.name,
          description: c.description,
          sortOrder: c.sortOrder,
          isActive: true,
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // Seed starter catalog products only on completely fresh DB
    const prodSnap = await getDocs(query(collection(db, 'products'), limit(1)));
    if (prodSnap.empty) {
      const starterProducts = [
        {
          id: 'prd_rb_14',
          sku: 'RB-ESF-14',
          name: 'میلگرد آجدار سایز ۱۴',
          categoryId: 'cat_rebar',
          categoryName: 'میلگرد',
          factory: 'ذوب‌آهن اصفهان',
          specs: 'گرید A3 (آج ۴۰۰)',
          size: '۱۴ میلی‌متر',
          thickness: '۱۴ میلی‌متر',
          length: '۱۲ متر',
          unit: 'کیلوگرم',
          weightPerUnitKg: 1,
          unitPrice: 31800,
          description: 'میلگرد استاندارد ساختمانی با برگ آنالیز کارخانه',
        },
        {
          id: 'prd_bm_16',
          sku: 'BM-ESF-16',
          name: 'تیرآهن IPE سایز ۱۶',
          categoryId: 'cat_beam',
          categoryName: 'تیرآهن',
          factory: 'ذوب‌آهن اصفهان',
          specs: 'استاندارد IPE',
          size: 'نمره ۱۶',
          thickness: 'استاندارد کارخانه',
          length: '۱۲ متر',
          unit: 'شاخه',
          weightPerUnitKg: 190,
          unitPrice: 6450000,
          description: 'تیرآهن شاخه ۱۲ متری ذوب‌آهن',
        },
        {
          id: 'prd_sh_04',
          sku: 'SH-MBR-04',
          name: 'ورق سیاه ضخامت ۴ میل',
          categoryId: 'cat_sheet',
          categoryName: 'ورق',
          factory: 'فولاد مبارکه اصفهان',
          specs: 'گرید ST37 صنعتی',
          size: '۱۲۵۰ × ۲۵۰۰ میلی‌متر',
          thickness: '۴ میلی‌متر',
          length: '۲.۵ متر',
          unit: 'کیلوگرم',
          weightPerUnitKg: 1,
          unitPrice: 38900,
          description: 'ورق نورد گرم فابریک فولاد مبارکه',
        },
      ];

      const batch = writeBatch(db);
      for (const p of starterProducts) {
        batch.set(doc(db, 'products', p.id), {
          ...p,
          isActive: true,
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'workspace_seed');
  }
}

export async function generateNextQuotationNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'quotations');
  try {
    const nextNum = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      if (!snap.exists()) {
        const initialNumber = 1001;
        tx.set(counterRef, {
          lastNumber: initialNumber,
          updatedAt: serverTimestamp(),
        });
        return initialNumber;
      }
      const current = Number(snap.data().lastNumber) || 1000;
      const updated = current + 1;
      tx.update(counterRef, {
        lastNumber: updated,
        updatedAt: serverTimestamp(),
      });
      return updated;
    });
    return `AG-${nextNum}`;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'counters/quotations');
  }
}

export async function fetchQuotationItems(quotationId: string): Promise<QuotationItem[]> {
  const path = `quotations/${quotationId}/items`;
  try {
    const q = query(collection(db, path), orderBy('rowIndex', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuotationItem, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchQuotationStatusHistory(
  quotationId: string
): Promise<QuotationStatusHistory[]> {
  const path = `quotations/${quotationId}/status_history`;
  try {
    const q = query(collection(db, path), orderBy('changedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<QuotationStatusHistory, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveQuotationWithItems(params: {
  existingQuotation: Quotation | null;
  actor: UserProfile;
  customer: Customer;
  issueDateShamsi: string;
  validDays: number;
  status: QuotationStatus;
  currency: 'تومان' | 'ریال';
  includeVat: boolean;
  vatRate: number;
  transportCost: number;
  discountAmount: number;
  paymentTerms: string;
  deliveryTerms: string;
  notes: string;
  items: Omit<QuotationItem, 'id' | 'rowIndex' | 'lineTotal'>[];
}): Promise<string> {
  const { existingQuotation, actor, customer, items } = params;
  const isEdit = Boolean(existingQuotation);
  const quotationId = existingQuotation?.id || generateSafeId('qt');
  const quotationNumber = existingQuotation?.quotationNumber || (await generateNextQuotationNumber());

  const computedItems: QuotationItem[] = items.map((item, idx) => {
    const qty = Math.max(0.01, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return {
      id: generateSafeId('qitem'),
      rowIndex: idx + 1,
      productId: sanitizeStr(item.productId, 128),
      sku: sanitizeStr(item.sku, 64),
      productName: sanitizeStr(item.productName, 180) || 'کالای سفارشی',
      specs: sanitizeStr(item.specs, 240),
      size: sanitizeStr(item.size, 80),
      unit: item.unit,
      quantity: qty,
      weightPerUnitKg: Math.max(0, Number(item.weightPerUnitKg) || 0),
      unitPrice: price,
      lineTotal: Math.round(qty * price),
    };
  });

  const totals = calculateQuotationTotals(
    computedItems,
    params.includeVat,
    params.vatRate,
    params.transportCost,
    params.discountAmount
  );

  const validDays = Math.min(365, Math.max(1, Math.round(params.validDays || 1)));
  const issueDateShamsi = sanitizeStr(params.issueDateShamsi, 20) || getShamsiDate();
  const validUntilShamsi = addDaysShamsi(validDays);

  try {
    // If editing, fetch existing item IDs to clean up replaced rows
    let previousItemIds: string[] = [];
    if (isEdit) {
      const prevSnap = await getDocs(collection(db, `quotations/${quotationId}/items`));
      previousItemIds = prevSnap.docs.map((d) => d.id);
    }

    const batch = writeBatch(db);
    const quotationRef = doc(db, 'quotations', quotationId);

    const quotationPayload = {
      quotationNumber: sanitizeStr(quotationNumber, 40),
      issueDateShamsi,
      validUntilShamsi,
      validDays,
      customerId: customer.id,
      customerName: sanitizeStr(customer.name, 140),
      customerMobile: sanitizeStr(customer.mobile, 30),
      customerCompanyOrProject: sanitizeStr(customer.companyOrProject, 180),
      customerAddress: sanitizeStr(
        [customer.city, customer.address].filter(Boolean).join('، '),
        400
      ),
      status: params.status,
      currency: params.currency,
      includeVat: Boolean(params.includeVat),
      vatRate: Math.min(50, Math.max(0, Number(params.vatRate) || 0)),
      itemsSubtotal: totals.itemsSubtotal,
      transportCost: totals.transportCost,
      discountAmount: totals.discountAmount,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      totalWeightKg: totals.totalWeightKg,
      itemCount: computedItems.length,
      paymentTerms: sanitizeStr(params.paymentTerms, 500),
      deliveryTerms: sanitizeStr(params.deliveryTerms, 500),
      notes: sanitizeStr(params.notes, 1000),
      createdByUid: existingQuotation?.createdByUid || actor.uid,
      createdByName: sanitizeStr(existingQuotation?.createdByName || actor.displayName, 120),
      createdAt: existingQuotation?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      batch.update(quotationRef, quotationPayload);
    } else {
      batch.set(quotationRef, quotationPayload);
    }

    for (const oldItemId of previousItemIds) {
      batch.delete(doc(db, `quotations/${quotationId}/items`, oldItemId));
    }

    for (const row of computedItems) {
      batch.set(doc(db, `quotations/${quotationId}/items`, row.id), {
        rowIndex: row.rowIndex,
        productId: row.productId || '',
        sku: row.sku || '',
        productName: row.productName,
        specs: row.specs || '',
        size: row.size || '',
        unit: row.unit,
        quantity: row.quantity,
        weightPerUnitKg: row.weightPerUnitKg,
        unitPrice: row.unitPrice,
        lineTotal: row.lineTotal,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
      });
    }

    if (!isEdit || existingQuotation?.status !== params.status) {
      const historyId = generateSafeId('hist');
      batch.set(doc(db, `quotations/${quotationId}/status_history`, historyId), {
        fromStatus: existingQuotation?.status || 'جدید',
        toStatus: params.status,
        note: isEdit ? 'بروزرسانی پیش‌فاکتور' : 'صدور اولیه پیش‌فاکتور',
        changedByUid: actor.uid,
        changedByName: sanitizeStr(actor.displayName, 120),
        changedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await recordAuditLog(
      actor,
      isEdit ? 'UPDATE_QUOTATION' : 'CREATE_QUOTATION',
      'quotation',
      quotationId,
      `${isEdit ? 'ویرایش' : 'صدور'} پیش‌فاکتور ${quotationNumber} برای ${customer.name}`
    );

    return quotationId;
  } catch (error) {
    handleFirestoreError(
      error,
      isEdit ? OperationType.UPDATE : OperationType.CREATE,
      `quotations/${quotationId}`
    );
  }
}

export async function updateQuotationStatus(
  quotation: Quotation,
  newStatus: QuotationStatus,
  actor: UserProfile,
  note?: string
) {
  if (quotation.status === newStatus) return;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'quotations', quotation.id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    const histId = generateSafeId('hist');
    batch.set(doc(db, `quotations/${quotation.id}/status_history`, histId), {
      fromStatus: quotation.status,
      toStatus: newStatus,
      note: sanitizeStr(note || `تغییر وضعیت به ${newStatus}`, 300),
      changedByUid: actor.uid,
      changedByName: sanitizeStr(actor.displayName, 120),
      changedAt: serverTimestamp(),
    });
    await batch.commit();

    await recordAuditLog(
      actor,
      'STATUS_CHANGE',
      'quotation',
      quotation.id,
      `تغییر وضعیت پیش‌فاکتور ${quotation.quotationNumber} از «${quotation.status}» به «${newStatus}»`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `quotations/${quotation.id}`);
  }
}

export async function deleteQuotationCascade(quotation: Quotation, actor: UserProfile) {
  try {
    const itemsSnap = await getDocs(collection(db, `quotations/${quotation.id}/items`));
    const batch = writeBatch(db);
    itemsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'quotations', quotation.id));
    await batch.commit();

    await recordAuditLog(
      actor,
      'DELETE_QUOTATION',
      'quotation',
      quotation.id,
      `حذف پیش‌فاکتور ${quotation.quotationNumber}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `quotations/${quotation.id}`);
  }
}

export async function saveCustomerDoc(
  customer: Omit<Customer, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: UserProfile
) {
  const isEdit = Boolean(customer.id);
  const id = customer.id || generateSafeId('cus');
  const ref = doc(db, 'customers', id);

  try {
    const payload = {
      name: sanitizeStr(customer.name, 140),
      mobile: sanitizeStr(customer.mobile, 30),
      secondaryPhone: sanitizeStr(customer.secondaryPhone, 30),
      companyOrProject: sanitizeStr(customer.companyOrProject, 180),
      customerType: customer.customerType,
      nationalId: sanitizeStr(customer.nationalId, 30),
      economicCode: sanitizeStr(customer.economicCode, 30),
      city: sanitizeStr(customer.city, 80),
      address: sanitizeStr(customer.address, 400),
      notes: sanitizeStr(customer.notes, 600),
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
      });
    }

    await recordAuditLog(
      actor,
      isEdit ? 'UPDATE_CUSTOMER' : 'CREATE_CUSTOMER',
      'customer',
      id,
      `${isEdit ? 'ویرایش' : 'ثبت'} مشتری ${payload.name}`
    );
  } catch (error) {
    handleFirestoreError(
      error,
      isEdit ? OperationType.UPDATE : OperationType.CREATE,
      `customers/${id}`
    );
  }
}

export async function deleteCustomerWithDependencyCheck(
  customer: Customer,
  quotations: Quotation[],
  actor: UserProfile
): Promise<{ ok: boolean; reason?: string }> {
  const hasQuotations = quotations.some((q) => q.customerId === customer.id);
  if (hasQuotations) {
    return {
      ok: false,
      reason: 'این مشتری دارای پیش‌فاکتور ثبت‌شده در سامانه است و امکان حذف آن وجود ندارد.',
    };
  }
  try {
    await deleteDoc(doc(db, 'customers', customer.id));
    await recordAuditLog(
      actor,
      'DELETE_CUSTOMER',
      'customer',
      customer.id,
      `حذف مشتری ${customer.name}`
    );
    return { ok: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `customers/${customer.id}`);
  }
}

export async function saveProductDoc(
  product: Omit<Product, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'> & { id?: string },
  actor: UserProfile
) {
  const isEdit = Boolean(product.id);
  const id = product.id || generateSafeId('prd');
  const ref = doc(db, 'products', id);

  try {
    const payload = {
      sku: sanitizeStr(product.sku, 64) || 'STL-001',
      name: sanitizeStr(product.name, 160),
      categoryId: sanitizeStr(product.categoryId, 128),
      categoryName: sanitizeStr(product.categoryName, 80),
      factory: sanitizeStr(product.factory, 120),
      specs: sanitizeStr(product.specs, 240),
      size: sanitizeStr(product.size, 80),
      thickness: sanitizeStr(product.thickness, 60),
      length: sanitizeStr(product.length, 60),
      unit: product.unit,
      weightPerUnitKg: Math.max(0, Number(product.weightPerUnitKg) || 0),
      unitPrice: Math.max(0, Number(product.unitPrice) || 0),
      description: sanitizeStr(product.description, 500),
      isActive: Boolean(product.isActive),
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
      });
    }

    await recordAuditLog(
      actor,
      isEdit ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
      'product',
      id,
      `${isEdit ? 'ویرایش' : 'ثبت'} کالا ${payload.name}`
    );
  } catch (error) {
    handleFirestoreError(
      error,
      isEdit ? OperationType.UPDATE : OperationType.CREATE,
      `products/${id}`
    );
  }
}

export async function updateProductPriceQuick(
  product: Product,
  newPrice: number,
  actor: UserProfile
) {
  try {
    await updateDoc(doc(db, 'products', product.id), {
      unitPrice: Math.max(0, Number(newPrice) || 0),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog(
      actor,
      'UPDATE_PRICE',
      'product',
      product.id,
      `بروزرسانی قیمت ${product.name} به ${newPrice}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
  }
}

export async function deleteProductSafe(
  product: Product,
  actor: UserProfile
) {
  try {
    await deleteDoc(doc(db, 'products', product.id));
    await recordAuditLog(
      actor,
      'DELETE_PRODUCT',
      'product',
      product.id,
      `حذف کالا ${product.name}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${product.id}`);
  }
}

export async function saveCategoryDoc(
  category: Omit<ProductCategoryDoc, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
  actor: UserProfile
) {
  const isEdit = Boolean(category.id);
  const id = category.id || generateSafeId('cat');
  const ref = doc(db, 'product_categories', id);
  try {
    const payload = {
      name: sanitizeStr(category.name, 80),
      description: sanitizeStr(category.description, 300),
      sortOrder: Math.max(0, Number(category.sortOrder) || 0),
      isActive: Boolean(category.isActive),
      updatedAt: serverTimestamp(),
    };
    if (isEdit) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isEdit ? OperationType.UPDATE : OperationType.CREATE,
      `product_categories/${id}`
    );
  }
}

export async function saveCompanySettingsDoc(
  settings: CompanySettings,
  actor: UserProfile
) {
  const ref = doc(db, 'company_settings', 'main');
  try {
    const payload = {
      companyName: sanitizeStr(settings.companyName, 160) || 'شرکت آهن آگرین',
      subtitle: sanitizeStr(settings.subtitle, 240),
      logoDataUrl: sanitizeStr(settings.logoDataUrl, 60000),
      phone: sanitizeStr(settings.phone, 60),
      email: sanitizeStr(settings.email, 140),
      website: sanitizeStr(settings.website, 140),
      address: sanitizeStr(settings.address, 400),
      nationalId: sanitizeStr(settings.nationalId, 40),
      economicCode: sanitizeStr(settings.economicCode, 40),
      registrationNo: sanitizeStr(settings.registrationNo, 40),
      bankInfo: sanitizeStr(settings.bankInfo, 400),
      defaultPaymentTerms: sanitizeStr(settings.defaultPaymentTerms, 500),
      defaultDeliveryTerms: sanitizeStr(settings.defaultDeliveryTerms, 500),
      defaultNotes: sanitizeStr(settings.defaultNotes, 800),
      disclaimerText: sanitizeStr(settings.disclaimerText, 1000),
      currency: settings.currency,
      defaultVatRate: Math.min(50, Math.max(0, Number(settings.defaultVatRate) || 0)),
      defaultIncludeVat: Boolean(settings.defaultIncludeVat),
      defaultValidDays: Math.min(365, Math.max(1, Number(settings.defaultValidDays) || 1)),
      updatedByUid: actor.uid,
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    await recordAuditLog(
      actor,
      'UPDATE_SETTINGS',
      'company_settings',
      'main',
      'بروزرسانی تنظیمات شرکت و پیش‌فاکتور'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'company_settings/main');
  }
}

export async function updateUserRoleAndStatus(
  targetUser: UserProfile,
  updates: { displayName: string; role: 'admin' | 'sales'; isActive: boolean; phone?: string },
  actor: UserProfile
) {
  try {
    await updateDoc(doc(db, 'users', targetUser.uid), {
      displayName: sanitizeStr(updates.displayName, 120),
      role: updates.role,
      isActive: Boolean(updates.isActive),
      phone: sanitizeStr(updates.phone, 40),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog(
      actor,
      'UPDATE_USER',
      'user',
      targetUser.uid,
      `تغییر دسترسی کاربر ${targetUser.email} به نقش ${updates.role === 'admin' ? 'مدیر سیستم' : 'کارمند فروش'} (${updates.isActive ? 'فعال' : 'غیرفعال'})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
  }
}

export async function createStaffInviteDoc(
  invite: { email: string; displayName: string; role: 'admin' | 'sales' },
  actor: UserProfile
) {
  const id = generateSafeId('inv');
  try {
    await setDoc(doc(db, 'staff_invites', id), {
      email: sanitizeStr(invite.email.toLowerCase(), 200),
      displayName: sanitizeStr(invite.displayName, 120),
      role: invite.role,
      isActive: true,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog(
      actor,
      'CREATE_INVITE',
      'staff_invite',
      id,
      `ثبت دعوت‌نامه همکاری برای ${invite.email}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `staff_invites/${id}`);
  }
}

export async function fetchAuditLogs(maxCount = 50): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
  }
}
