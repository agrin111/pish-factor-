import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

type Row = Record<string, unknown>;

interface MockStore {
  user: Row[];
  session: Row[];
  customer: Row[];
  productCategory: Row[];
  product: Row[];
  quotation: Row[];
  quotationItem: Row[];
  quotationStatusHistory: Row[];
  companySettings: Row[];
  numberSequence: Row[];
  auditLog: Row[];
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __mockPrismaStore: MockStore | undefined;
  // eslint-disable-next-line no-var
  var __prismaUseMock: boolean | undefined;
}

function hashSeedPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

function createInitialMockStore(): MockStore {
  const now = new Date();
  const adminId = 'seed-admin-1';
  const username = (process.env.SEED_ADMIN_USERNAME ?? 'admin').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Aghrin@1404';
  const fullName = process.env.SEED_ADMIN_NAME ?? 'مدیر سیستم';

  const cat1 = 'cat-1';
  const cat2 = 'cat-2';
  const cat3 = 'cat-3';
  const cat4 = 'cat-4';
  const cat5 = 'cat-5';

  return {
    user: [
      {
        id: adminId,
        username,
        fullName,
        passwordHash: hashSeedPassword(password),
        role: 'ADMIN',
        isActive: true,
        phone: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    session: [],
    customer: [
      {
        id: 'cust-1',
        name: 'مشتری نمونه',
        mobile: '09120000000',
        secondaryPhone: null,
        companyOrProject: 'پروژه نمایشی',
        customerType: 'COMPANY',
        nationalId: null,
        economicCode: null,
        city: 'تهران',
        address: 'تهران، خیابان نمونه',
        notes: 'داده نمایشی محیط توسعه',
        createdById: adminId,
        createdAt: now,
        updatedAt: now,
      },
    ],
    productCategory: [
      { id: cat1, name: 'مصالح ساختمانی', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
      { id: cat2, name: 'آهن آلات ساختمانی', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
      { id: cat3, name: 'ابزار آلات ساختمانی', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
      { id: cat4, name: 'تاسیسات', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: cat5, name: 'آلیاژی', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
    ],
    product: [
      {
        id: 'prod-1',
        sku: 'ST-1250-G',
        name: 'ورق گالوانیزه ۱۲۵۰',
        categoryId: cat2,
        factory: null,
        specs: 'گرید ST12 — روکش روی ۱۲۰ گرم',
        size: '۱۲۵۰ میلی‌متر',
        thickness: '۰.۵ میلی‌متر',
        length: '۲۵۰۰ میلی‌متر',
        unit: 'SHEET',
        weightPerUnitKg: new Prisma.Decimal(12.5),
        unitPrice: new Prisma.Decimal(1250000),
        description: 'داده نمایشی محیط توسعه',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod-2',
        sku: 'PR-4040',
        name: 'پروفیل قوطی ۴۰×۴۰',
        categoryId: cat2,
        factory: null,
        specs: 'ضخامت ۲ میلی‌متر — طول شاخه ۶ متر',
        size: '۴۰×۴۰',
        thickness: '۲ میلی‌متر',
        length: '۶۰۰۰ میلی‌متر',
        unit: 'BRANCH',
        weightPerUnitKg: new Prisma.Decimal(14.2),
        unitPrice: new Prisma.Decimal(890000),
        description: 'داده نمایشی محیط توسعه',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod-3',
        sku: 'RB-16',
        name: 'میلگرد آجدار سایز ۱۶',
        categoryId: cat2,
        factory: null,
        specs: 'A3 — کارخانه فولاد',
        size: '۱۶',
        thickness: '',
        length: '۱۲۰۰۰ میلی‌متر',
        unit: 'KILOGRAM',
        weightPerUnitKg: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(42000),
        description: 'داده نمایشی محیط توسعه',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod-4',
        sku: 'IP-14',
        name: 'تیرآهن ۱۴',
        categoryId: cat5,
        factory: null,
        specs: 'IPE — طول شاخه ۱۲ متر',
        size: '۱۴',
        thickness: '',
        length: '۱۲۰۰۰ میلی‌متر',
        unit: 'KILOGRAM',
        weightPerUnitKg: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(45500),
        description: 'داده نمایشی محیط توسعه',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    quotation: [],
    quotationItem: [],
    quotationStatusHistory: [],
    companySettings: [
      {
        id: 1,
        companyName: 'شرکت آهن آگرین',
        subtitle: null,
        logoDataUrl: null,
        phone: null,
        secondaryPhone: null,
        email: null,
        website: null,
        address: null,
        nationalId: null,
        economicCode: null,
        registrationNo: null,
        bankInfo: null,
        defaultPaymentTerms: '۵۰٪ پیش‌پرداخت و مابقی هنگام تحویل کالا',
        defaultDeliveryTerms: 'تحویل در محل کارخانه فروشنده — هزینه حمل به عهده خریدار',
        defaultNotes: null,
        disclaimerText:
          'این پیش‌فاکتور تا تاریخ اعتبار اعلام‌شده معتبر است. مبالغ بر اساس نرخ روز بازار محاسبه شده و تغییر نرخ ارز یا مواد اولیه می‌تواند موجب بازنگری قیمت شود.',
        currency: 'TOMAN',
        defaultVatRate: new Prisma.Decimal(10),
        defaultIncludeVat: false,
        defaultValidDays: 7,
        numberPrefix: 'AG',
        miscCompanyName: null,
        miscSubtitle: null,
        miscLogoDataUrl: null,
        miscPhone: null,
        miscSecondaryPhone: null,
        miscEmail: null,
        miscWebsite: null,
        miscAddress: null,
        miscNationalId: null,
        miscEconomicCode: null,
        miscRegistrationNo: null,
        miscBankInfo: null,
        updatedAt: now,
      },
    ],
    numberSequence: [],
    auditLog: [],
  };
}

function serializeMockStore(store: MockStore): string {
  return JSON.stringify(
    store,
    function (_key, val) {
      const raw = this && typeof this === 'object' ? (this as Record<string, unknown>)[_key] : val;
      if (raw instanceof Date) {
        return { __pfType: 'Date', value: raw.toISOString() };
      }
      if (raw instanceof Prisma.Decimal || Prisma.Decimal.isDecimal(raw)) {
        return { __pfType: 'Decimal', value: String(raw) };
      }
      return val;
    },
    2,
  );
}

function deserializeMockStore(rawJson: string): MockStore {
  return JSON.parse(rawJson, (_key, value) => {
    if (value && typeof value === 'object' && '__pfType' in value) {
      if (value.__pfType === 'Date') return new Date(String(value.value));
      if (value.__pfType === 'Decimal') return new Prisma.Decimal(String(value.value));
    }
    return value;
  }) as MockStore;
}

function persistMockStore(store: MockStore): void {
  const file = process.env.PISHFACTOR_DATA_FILE;
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, serializeMockStore(store), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    console.warn('[AI Studio] Failed to persist local store:', err);
  }
}

function getMockStore(): MockStore {
  if (!global.__mockPrismaStore) {
    const defaults = createInitialMockStore();
    const file = process.env.PISHFACTOR_DATA_FILE;
    if (file && fs.existsSync(file)) {
      try {
        const loaded = deserializeMockStore(fs.readFileSync(file, 'utf8'));
        const merged: MockStore = { ...defaults, ...loaded };
        if (merged.companySettings.length > 0) {
          merged.companySettings[0] = {
            ...defaults.companySettings[0],
            ...merged.companySettings[0],
          };
        }
        merged.quotation = merged.quotation.map((q) => ({
          letterheadType: 'MAIN',
          ...q,
        }));
        let addedDefaultCategory = false;
        for (const cat of defaults.productCategory) {
          if (!merged.productCategory.some((existing) => existing.name === cat.name)) {
            merged.productCategory.push({ ...cat, id: randomUUID() });
            addedDefaultCategory = true;
          }
        }
        global.__mockPrismaStore = merged;
        if (addedDefaultCategory) persistMockStore(merged);
      } catch {
        global.__mockPrismaStore = defaults;
        persistMockStore(global.__mockPrismaStore);
      }
    } else {
      global.__mockPrismaStore = defaults;
      persistMockStore(global.__mockPrismaStore);
    }
  }
  return global.__mockPrismaStore;
}

function toComparable(value: unknown): number | string {
  if (value instanceof Date) return value.getTime();
  if (value instanceof Prisma.Decimal) return Number(value.toString());
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value ?? '');
}

function matchesCondition(value: unknown, cond: unknown): boolean {
  if (cond === undefined) return true;
  if (cond === null || typeof cond !== 'object' || cond instanceof Date || cond instanceof Prisma.Decimal) {
    return toComparable(value) === toComparable(cond);
  }
  const obj = cond as Record<string, unknown>;
  if ('equals' in obj && toComparable(value) !== toComparable(obj.equals)) return false;
  if ('not' in obj && toComparable(value) === toComparable(obj.not)) return false;
  if ('in' in obj && Array.isArray(obj.in)) {
    const set = obj.in.map((v) => toComparable(v));
    if (!set.includes(toComparable(value))) return false;
  }
  if ('lt' in obj && !(toComparable(value) < toComparable(obj.lt))) return false;
  if ('lte' in obj && !(toComparable(value) <= toComparable(obj.lte))) return false;
  if ('gt' in obj && !(toComparable(value) > toComparable(obj.gt))) return false;
  if ('gte' in obj && !(toComparable(value) >= toComparable(obj.gte))) return false;
  if ('contains' in obj) {
    const str = String(value ?? '');
    const needle = String(obj.contains ?? '');
    if (obj.mode === 'insensitive') {
      if (!str.toLowerCase().includes(needle.toLowerCase())) return false;
    } else if (!str.includes(needle)) {
      return false;
    }
  }
  return true;
}

function matchesWhere(row: Row, where?: Row): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'OR' && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesWhere(row, sub as Row))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(cond)) {
      if (!cond.every((sub) => matchesWhere(row, sub as Row))) return false;
      continue;
    }
    if (!matchesCondition(row[key], cond)) return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy?: Row | Row[]): Row[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      for (const [key, dir] of Object.entries(spec)) {
        const va = toComparable(a[key]);
        const vb = toComparable(b[key]);
        if (va === vb) continue;
        const cmp = va < vb ? -1 : 1;
        return dir === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function hydrateRow(
  table: keyof MockStore,
  row: Row,
  store: MockStore,
  options?: { select?: Row; include?: Row },
): Row {
  const result: Row = { ...row };

  const applySelect = (source: Row, sel?: Row): Row => {
    if (!sel) return { ...source };
    const out: Row = {};
    for (const [k, v] of Object.entries(sel)) {
      if (v) out[k] = source[k];
    }
    return out;
  };

  if (options?.include) {
    const inc = options.include;
    if (table === 'session' && inc.user) {
      result.user = store.user.find((u) => u.id === row.userId) ?? null;
    }
    if (table === 'customer' && inc._count) {
      result._count = {
        quotations: store.quotation.filter((q) => q.customerId === row.id).length,
      };
    }
    if (table === 'productCategory' && inc._count) {
      result._count = {
        products: store.product.filter((p) => p.categoryId === row.id).length,
      };
    }
    if (table === 'product' && inc.category) {
      const cat = store.productCategory.find((c) => c.id === row.categoryId) ?? null;
      result.category = cat ? applySelect(cat, (inc.category as Row).select as Row | undefined) : null;
    }
    if (table === 'user' && inc._count) {
      result._count = {
        quotations: store.quotation.filter((q) => q.createdById === row.id).length,
        customers: store.customer.filter((c) => c.createdById === row.id).length,
      };
    }
    if (table === 'quotation') {
      if (inc.items) {
        let items = store.quotationItem.filter((i) => i.quotationId === row.id);
        const itemOpt = inc.items as Row;
        if (typeof itemOpt === 'object' && itemOpt.orderBy) {
          items = sortRows(items, itemOpt.orderBy as Row);
        }
        result.items = items;
      }
      if (inc.createdBy) {
        const u = store.user.find((x) => x.id === row.createdById) ?? null;
        result.createdBy = u ? applySelect(u, (inc.createdBy as Row).select as Row | undefined) : null;
      }
      if (inc.statusHistory) {
        let hist = store.quotationStatusHistory.filter((h) => h.quotationId === row.id);
        const histOpt = inc.statusHistory as Row;
        if (typeof histOpt === 'object' && histOpt.orderBy) {
          hist = sortRows(hist, histOpt.orderBy as Row);
        }
        const histInc = typeof histOpt === 'object' ? (histOpt.include as Row | undefined) : undefined;
        result.statusHistory = hist.map((h) => {
          const copy: Row = { ...h };
          if (histInc?.changedBy) {
            const u = store.user.find((x) => x.id === h.changedById) ?? null;
            copy.changedBy = u ? applySelect(u, (histInc.changedBy as Row).select as Row | undefined) : null;
          }
          return copy;
        });
      }
      if (inc._count) {
        result._count = {
          items: store.quotationItem.filter((i) => i.quotationId === row.id).length,
        };
      }
    }
  }

  if (options?.select) {
    return applySelect(result, options.select);
  }
  return result;
}

function createModelDelegate(table: keyof MockStore, store: MockStore) {
  return {
    findUnique: async (args?: { where?: Row; select?: Row; include?: Row }) => {
      const found = store[table].find((r) => matchesWhere(r, args?.where));
      return found ? hydrateRow(table, found, store, args) : null;
    },
    findFirst: async (args?: { where?: Row; orderBy?: Row | Row[]; select?: Row; include?: Row }) => {
      const filtered = store[table].filter((r) => matchesWhere(r, args?.where));
      const sorted = sortRows(filtered, args?.orderBy);
      return sorted[0] ? hydrateRow(table, sorted[0], store, args) : null;
    },
    findMany: async (args?: {
      where?: Row;
      orderBy?: Row | Row[];
      skip?: number;
      take?: number;
      select?: Row;
      include?: Row;
    }) => {
      const filtered = store[table].filter((r) => matchesWhere(r, args?.where));
      const sorted = sortRows(filtered, args?.orderBy);
      const sliced = sorted.slice(
        args?.skip ?? 0,
        args?.take !== undefined ? (args?.skip ?? 0) + args.take : undefined,
      );
      return sliced.map((r) => hydrateRow(table, r, store, args));
    },
    count: async (args?: { where?: Row }) => {
      return store[table].filter((r) => matchesWhere(r, args?.where)).length;
    },
    create: async (args: { data: Row; include?: Row }) => {
      const now = new Date();
      const rawData = { ...args.data };
      const nestedItems = rawData.items as { create?: Row[] } | undefined;
      const nestedHistory = rawData.statusHistory as { create?: Row | Row[] } | undefined;
      delete rawData.items;
      delete rawData.statusHistory;

      if (table === 'user' || table === 'product' || table === 'productCategory') {
        const uniqueKey = table === 'user' ? 'username' : table === 'product' ? 'sku' : 'name';
        if (store[table].some((r) => r[uniqueKey] === rawData[uniqueKey])) {
          const err = new Error('Unique constraint failed') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
      }

      const id = rawData.id ?? (table === 'companySettings' ? 1 : randomUUID());
      const row: Row = {
        ...rawData,
        id,
        createdAt: rawData.createdAt ?? now,
        updatedAt: now,
      };
      store[table].push(row);

      if (table === 'quotation') {
        if (nestedItems?.create) {
          for (const item of nestedItems.create) {
            store.quotationItem.push({
              ...item,
              id: randomUUID(),
              quotationId: id,
            });
          }
        }
        if (nestedHistory?.create) {
          const entries = Array.isArray(nestedHistory.create) ? nestedHistory.create : [nestedHistory.create];
          for (const entry of entries) {
            store.quotationStatusHistory.push({
              ...entry,
              id: randomUUID(),
              quotationId: id,
              createdAt: now,
            });
          }
        }
      }

      persistMockStore(store);
      return hydrateRow(table, row, store, { include: args.include });
    },
    update: async (args: { where: Row; data: Row }) => {
      const row = store[table].find((r) => matchesWhere(r, args.where));
      if (!row) throw new Error('Record not found');
      const now = new Date();
      const rawData = { ...args.data };
      const nestedItems = rawData.items as { create?: Row[] } | undefined;
      delete rawData.items;

      for (const [k, v] of Object.entries(rawData)) {
        if (v !== undefined) row[k] = v;
      }
      row.updatedAt = now;

      if (table === 'quotation' && nestedItems?.create) {
        for (const item of nestedItems.create) {
          store.quotationItem.push({
            ...item,
            id: randomUUID(),
            quotationId: row.id,
          });
        }
      }

      persistMockStore(store);
      return { ...row };
    },
    upsert: async (args: { where: Row; create: Row; update: Row }) => {
      const existing = store[table].find((r) => matchesWhere(r, args.where));
      if (existing) {
        for (const [k, v] of Object.entries(args.update)) {
          if (v !== undefined) existing[k] = v;
        }
        existing.updatedAt = new Date();
        persistMockStore(store);
        return { ...existing };
      }
      const now = new Date();
      const row: Row = {
        ...args.create,
        id: args.create.id ?? (table === 'companySettings' ? 1 : randomUUID()),
        createdAt: now,
        updatedAt: now,
      };
      store[table].push(row);
      persistMockStore(store);
      return { ...row };
    },
    delete: async (args: { where: Row }) => {
      const idx = store[table].findIndex((r) => matchesWhere(r, args.where));
      if (idx === -1) throw new Error('Record not found');
      const [removed] = store[table].splice(idx, 1);
      if (table === 'quotation') {
        store.quotationItem = store.quotationItem.filter((i) => i.quotationId !== removed.id);
        store.quotationStatusHistory = store.quotationStatusHistory.filter((h) => h.quotationId !== removed.id);
      }
      persistMockStore(store);
      return removed;
    },
    deleteMany: async (args?: { where?: Row }) => {
      const before = store[table].length;
      store[table] = store[table].filter((r) => !matchesWhere(r, args?.where));
      if (before !== store[table].length) persistMockStore(store);
      return { count: before - store[table].length };
    },
    groupBy: async (args: { by: string[]; _count?: { _all?: boolean } }) => {
      const field = args.by[0];
      const counts = new Map<unknown, number>();
      for (const row of store[table]) {
        const val = row[field];
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
      return [...counts.entries()].map(([val, count]) => ({
        [field]: val,
        _count: { _all: count },
      }));
    },
    aggregate: async (args: { where?: Row; _sum?: Record<string, boolean> }) => {
      const filtered = store[table].filter((r) => matchesWhere(r, args.where));
      const sumOut: Record<string, Prisma.Decimal | null> = {};
      if (args._sum) {
        for (const key of Object.keys(args._sum)) {
          let total = new Prisma.Decimal(0);
          for (const row of filtered) {
            const val = row[key];
            if (val !== null && val !== undefined) {
              total = total.add(new Prisma.Decimal(val as Prisma.Decimal.Value));
            }
          }
          sumOut[key] = filtered.length > 0 ? total : null;
        }
      }
      return { _sum: sumOut };
    },
  };
}

function createMockPrisma(): Record<string, unknown> {
  const store = getMockStore();
  const mockClient: Record<string, unknown> = {
    user: createModelDelegate('user', store),
    session: createModelDelegate('session', store),
    customer: createModelDelegate('customer', store),
    productCategory: createModelDelegate('productCategory', store),
    product: createModelDelegate('product', store),
    quotation: createModelDelegate('quotation', store),
    quotationItem: createModelDelegate('quotationItem', store),
    quotationStatusHistory: createModelDelegate('quotationStatusHistory', store),
    companySettings: createModelDelegate('companySettings', store),
    numberSequence: createModelDelegate('numberSequence', store),
    auditLog: createModelDelegate('auditLog', store),
    $queryRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = String(values[0] ?? '');
      const seq = store.numberSequence.find((s) => s.key === key);
      if (seq) {
        seq.value = Number(seq.value ?? 0) + 1;
        seq.updatedAt = new Date();
        persistMockStore(store);
        return [{ value: seq.value }];
      }
      return [];
    },
    $transaction: async (
      arg: ((tx: Prisma.TransactionClient) => Promise<unknown>) | Promise<unknown>[],
    ) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg(mockClient as unknown as Prisma.TransactionClient);
    },
    $disconnect: async () => {},
  };

  return mockClient;
}

function isDbConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return (
    error.name === 'PrismaClientInitializationError' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1003' ||
    error.message.includes("Can't reach database server") ||
    error.message.includes('Environment variable not found: DATABASE_URL')
  );
}

function createResilientPrisma(): PrismaClient {
  const mock = createMockPrisma();
  let real: PrismaClient | null = null;

  if (!process.env.DATABASE_URL) {
    global.__prismaUseMock = true;
    console.warn('[AI Studio] DATABASE_URL not configured — using local store');
  } else {
    try {
      real = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    } catch {
      global.__prismaUseMock = true;
      console.warn('[AI Studio] Database not connected — using local store');
    }
  }

  const switchToMock = () => {
    if (!global.__prismaUseMock) {
      global.__prismaUseMock = true;
      console.warn('[AI Studio] Database unreachable — falling back to local store');
    }
  };

  const proxy = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (global.__prismaUseMock || !real) {
          return mock[prop];
        }

        const realProp = (real as unknown as Record<string, unknown>)[prop];
        const mockProp = mock[prop];

        if (prop === '$transaction') {
          return async (arg: unknown) => {
            if (global.__prismaUseMock || !real) {
              return (mockProp as (a: unknown) => Promise<unknown>)(arg);
            }
            try {
              return await (realProp as (a: unknown) => Promise<unknown>)(arg);
            } catch (error) {
              if (isDbConnectionError(error)) {
                switchToMock();
                return (mockProp as (a: unknown) => Promise<unknown>)(arg);
              }
              throw error;
            }
          };
        }

        if (prop === '$queryRaw' || prop === '$disconnect') {
          return async (...args: unknown[]) => {
            if (global.__prismaUseMock || !real) {
              return (mockProp as (...a: unknown[]) => Promise<unknown>)(...args);
            }
            try {
              return await (realProp as (...a: unknown[]) => Promise<unknown>)(...args);
            } catch (error) {
              if (isDbConnectionError(error)) {
                switchToMock();
                return (mockProp as (...a: unknown[]) => Promise<unknown>)(...args);
              }
              throw error;
            }
          };
        }

        if (realProp && typeof realProp === 'object' && mockProp && typeof mockProp === 'object') {
          return new Proxy(realProp as Record<string, unknown>, {
            get(modelTarget, method: string) {
              if (global.__prismaUseMock) {
                return (mockProp as Record<string, unknown>)[method];
              }
              const realMethod = modelTarget[method];
              const mockMethod = (mockProp as Record<string, unknown>)[method];
              if (typeof realMethod !== 'function') return realMethod;
              return async (...args: unknown[]) => {
                if (global.__prismaUseMock) {
                  return (mockMethod as (...a: unknown[]) => Promise<unknown>)(...args);
                }
                try {
                  return await (realMethod as (...a: unknown[]) => Promise<unknown>).apply(
                    modelTarget,
                    args,
                  );
                } catch (error) {
                  if (isDbConnectionError(error)) {
                    switchToMock();
                    return (mockMethod as (...a: unknown[]) => Promise<unknown>)(...args);
                  }
                  throw error;
                }
              };
            },
          });
        }

        return realProp ?? mockProp;
      },
    },
  );

  return proxy as unknown as PrismaClient;
}

export const prisma: PrismaClient = global.__prisma ?? createResilientPrisma();

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;
