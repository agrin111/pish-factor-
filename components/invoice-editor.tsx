'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Plus, Save, Trash2 } from 'lucide-react';
import type { LetterheadType, QuotationStatus, UnitType } from '@prisma/client';
import { saveQuotationAction } from '@/actions/quotations';
import { initialActionState } from '@/lib/forms';
import { SubmitButton } from '@/components/submit-button';
import {
  amountInWords,
  formatCurrency,
  formatNumber,
  toEnglishDigits,
  toNumber,
  toPersianDigits,
} from '@/lib/format';
import { NumberField } from '@/components/number-field';
import { STATUS_LABEL, UNITS, UNIT_LABEL } from '@/lib/labels';
import { addDays, formatJalali, parseJalaliInput } from '@/lib/jalali';

export interface EditorCustomer {
  id: string;
  name: string;
  mobile: string;
  companyOrProject: string | null;
  address: string | null;
}

export interface EditorProduct {
  id: string;
  sku: string;
  name: string;
  specs: string | null;
  size: string | null;
  unit: UnitType;
  unitPrice: string;
  weightPerUnitKg: string;
}

export interface EditorQuotation {
  id: string;
  customerId: string;
  issueDateLabel: string;
  validDays: number;
  status: QuotationStatus;
  currency: 'TOMAN' | 'RIAL';
  includeVat: boolean;
  vatRate: string;
  transportCost: string;
  discountAmount: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
  letterheadType: LetterheadType;
  items: {
    id: string;
    productId: string | null;
    sku: string | null;
    productName: string;
    specs: string | null;
    size: string | null;
    unit: UnitType;
    quantity: string;
    unitPrice: string;
    weightKg: string;
  }[];
}

interface Props {
  customers: EditorCustomer[];
  products: EditorProduct[];
  defaults: {
    currency: 'TOMAN' | 'RIAL';
    includeVat: boolean;
    vatRate: string;
    validDays: number;
    paymentTerms: string | null;
    deliveryTerms: string | null;
  };
  existing?: EditorQuotation;
}

interface RowState {
  key: string;
  productId: string;
  sku: string;
  productName: string;
  specs: string;
  size: string;
  unit: UnitType;
  quantity: string;
  unitPrice: string;
  weightKg: string;
}

let rowCounter = 0;
const newKey = () => `row-${Date.now()}-${(rowCounter += 1)}`;

function emptyRow(): RowState {
  return {
    key: newKey(),
    productId: '',
    sku: '',
    productName: '',
    specs: '',
    size: '',
    unit: 'KILOGRAM',
    quantity: '1',
    unitPrice: '',
    weightKg: '0',
  };
}

export function InvoiceEditor({ customers, products, defaults, existing }: Props) {
  const router = useRouter();

  const [customerId, setCustomerId] = useState(existing?.customerId ?? '');
  const [issueDate, setIssueDate] = useState(
    existing?.issueDateLabel ?? formatJalali(new Date()),
  );
  const [validDays, setValidDays] = useState(String(existing?.validDays ?? defaults.validDays));
  const [status, setStatus] = useState<QuotationStatus>(existing?.status ?? 'DRAFT');
  const [currency, setCurrency] = useState<'TOMAN' | 'RIAL'>(
    existing?.currency ?? defaults.currency,
  );
  const [includeVat, setIncludeVat] = useState(existing?.includeVat ?? defaults.includeVat);
  const [vatRate, setVatRate] = useState(existing?.vatRate ?? defaults.vatRate);
  const [transportCost, setTransportCost] = useState(existing?.transportCost ?? '0');
  const [discountAmount, setDiscountAmount] = useState(existing?.discountAmount ?? '0');
  const [paymentTerms, setPaymentTerms] = useState(
    existing?.paymentTerms ?? defaults.paymentTerms ?? '',
  );
  const [deliveryTerms, setDeliveryTerms] = useState(
    existing?.deliveryTerms ?? defaults.deliveryTerms ?? '',
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [letterheadType, setLetterheadType] = useState<LetterheadType>(
    existing?.letterheadType ?? 'MAIN',
  );

  const [rows, setRows] = useState<RowState[]>(
    existing
      ? existing.items.map((item) => ({
          key: newKey(),
          productId: item.productId ?? '',
          sku: item.sku ?? '',
          productName: item.productName,
          specs: item.specs ?? '',
          size: item.size ?? '',
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          weightKg: item.weightKg,
        }))
      : [emptyRow()],
  );

  const [state, setState] = useState(initialActionState);
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState('');

  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const totals = useMemo(() => {
    const lines = rows.map((row) => Math.round(toNumber(row.quantity) * toNumber(row.unitPrice)));
    const itemsSubtotal = lines.reduce((acc, line) => acc + line, 0);
    const transport = Math.round(toNumber(transportCost));
    const discount = Math.round(toNumber(discountAmount));
    const rate = toNumber(vatRate);
    const vatAmount = includeVat
      ? Math.round(Math.max(0, itemsSubtotal - discount) * (rate / 100))
      : 0;
    const grandTotal = Math.max(0, itemsSubtotal + transport + vatAmount - discount);
    return { lines, itemsSubtotal, transport, discount, vatAmount, grandTotal };
  }, [rows, transportCost, discountAmount, vatRate, includeVat]);

  useEffect(() => {
    if (state.ok) {
      const created = state.data as { id?: string } | undefined;
      if (created?.id) router.push(`/invoices/${created.id}`);
      else router.push('/invoices');
    }
  }, [state, router]);

  useEffect(() => {
    if (!state.ok && state.message) setSubmitting(false);
  }, [state]);

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const applyProduct = (key: string, productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      updateRow(key, { productId: '' });
      return;
    }
    updateRow(key, {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      specs: product.specs ?? '',
      size: product.size ?? '',
      unit: product.unit,
      weightKg: product.weightPerUnitKg,
    });
  };

  const buildPayload = () => ({
    id: existing?.id,
    customerId,
    issueDate,
    validDays: Number(validDays) || 0,
    status,
    currency,
    includeVat,
    vatRate: toNumber(vatRate),
    transportCost: toNumber(transportCost),
    discountAmount: toNumber(discountAmount),
    paymentTerms,
    deliveryTerms,
    notes,
    letterheadType,
    items: rows.map((row, index) => ({
      rowIndex: index + 1,
      productId: row.productId || undefined,
      sku: row.sku || undefined,
      productName: row.productName,
      specs: row.specs || undefined,
      size: row.size || undefined,
      unit: row.unit,
      quantity: toNumber(row.quantity),
      unitPrice: toNumber(row.unitPrice),
      weightKg: toNumber(row.weightKg),
    })),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientError('');

    if (!customerId) {
      setClientError('ابتدا مشتری را انتخاب کنید.');
      return;
    }
    if (!parseJalaliInput(issueDate)) {
      setClientError('تاریخ صدور معتبر نیست. نمونه صحیح: ۱۴۰۵/۰۸/۲۸');
      return;
    }
    if (rows.length === 0 || rows.some((row) => !row.productName.trim())) {
      setClientError('هر ردیف باید نام کالا داشته باشد.');
      return;
    }
    if (rows.some((row) => toNumber(row.quantity) <= 0)) {
      setClientError('مقدار هر ردیف باید بزرگ‌تر از صفر باشد.');
      return;
    }
    if (rows.some((row) => row.unitPrice.trim() === '')) {
      setClientError('قیمت واحد هر کالا را در پیش‌فاکتور وارد کنید.');
      return;
    }

    const formData = new FormData();
    formData.set('payload', JSON.stringify(buildPayload()));

    setSubmitting(true);
    try {
      const result = await saveQuotationAction(initialActionState, formData);
      setState(result);
    } catch {
      setClientError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  };

  const validityDate = parseJalaliInput(issueDate);
  const validUntilLabel = validityDate
    ? formatJalali(addDays(validityDate, Number(validDays) || 0))
    : '—';

  if (customers.length === 0) {
    return (
      <div className="card card-pad space-y-3">
        <h1 className="text-lg font-bold">ابتدا مشتری ثبت کنید</h1>
        <p className="muted text-sm">
          برای صدور پیش‌فاکتور باید حداقل یک مشتری در سامانه ثبت شده باشد.
        </p>
        <Link href="/customers" className="btn btn-primary w-fit">
          رفتن به مدیریت مشتریان
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">
            {existing ? `ویرایش پیش‌فاکتور ${existing.customerId ? '' : ''}` : 'صدور پیش‌فاکتور جدید'}
          </h1>
          <p className="muted mt-1 text-xs">
            شماره پیش‌فاکتور به‌صورت خودکار و یکتا تولید می‌شود؛ همه محاسبات در سرور بازبینی می‌شوند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/invoices" className="btn btn-secondary">
            بازگشت به آرشیو
          </Link>
          <SubmitButton className="btn btn-primary" pendingLabel="در حال ذخیره...">
            <Save className="h-4 w-4" />
            {status === 'DRAFT' ? 'ذخیره پیش‌نویس' : 'ثبت نهایی سند'}
          </SubmitButton>
        </div>
      </div>

      {(clientError || state.message) && (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
            state.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p>{clientError || state.message}</p>
            {state.errors && (
              <ul className="list-inside list-disc space-y-0.5">
                {Object.entries(state.errors).map(([field, messages]) => (
                  <li key={field}>{messages?.[0]}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="card card-pad grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="customerId">
            مشتری *
          </label>
          <select
            id="customerId"
            className="select"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            required
          >
            <option value="">انتخاب مشتری...</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} — {customer.mobile}
                {customer.companyOrProject ? ` — ${customer.companyOrProject}` : ''}
              </option>
            ))}
          </select>
          {selectedCustomer && (
            <p className="field-hint">
              موبایل: <span className="numeric">{selectedCustomer.mobile}</span>
              {selectedCustomer.address ? ` — ${selectedCustomer.address}` : ''}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="issueDate">
            تاریخ صدور *
          </label>
          <input
            id="issueDate"
            className="input numeric"
            dir="ltr"
            value={toPersianDigits(issueDate)}
            onChange={(event) => setIssueDate(toEnglishDigits(event.target.value))}
            placeholder="۱۴۰۵/۰۸/۲۸"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="validDays">
            مدت اعتبار (روز)
          </label>
          <NumberField
            id="validDays"
            className="input numeric"
            allowDecimal={false}
            inputMode="numeric"
            value={validDays}
            onValueChange={setValidDays}
          />
          <p className="field-hint">اعتبار تا: {validUntilLabel}</p>
        </div>

        <div>
          <label className="label" htmlFor="status">
            وضعیت سند
          </label>
          <select
            id="status"
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as QuotationStatus)}
          >
            {(['DRAFT', 'SENT', 'APPROVED', 'CANCELLED'] as QuotationStatus[]).map((item) => (
              <option key={item} value={item}>
                {STATUS_LABEL[item]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="currency">
            واحد پول
          </label>
          <select
            id="currency"
            className="select"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as 'TOMAN' | 'RIAL')}
          >
            <option value="TOMAN">تومان</option>
            <option value="RIAL">ریال</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="letterheadType">
            نوع سربرگ پیش‌فاکتور
          </label>
          <select
            id="letterheadType"
            className="select"
            value={letterheadType}
            onChange={(event) => setLetterheadType(event.target.value as LetterheadType)}
          >
            <option value="MAIN">سربرگ اصلی شرکت</option>
            <option value="MISC">سربرگ متفرقه</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="vatRate">
            درصد مالیات
          </label>
          <div className="flex items-center gap-2">
            <NumberField
              id="vatRate"
              className="input numeric"
              value={vatRate}
              onValueChange={setVatRate}
            />
            <label className="flex items-center gap-1 whitespace-nowrap text-xs">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={includeVat}
                onChange={(event) => setIncludeVat(event.target.checked)}
              />
              اعمال مالیات
            </label>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7DEE5] px-4 py-3">
          <h2 className="section-title">ردیف‌های کالا</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setRows((current) => [...current, emptyRow()])}
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن ردیف دلخواه
          </button>
        </div>

        <div className="table-wrap !rounded-none !border-0">
          <table className="data" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ width: 46 }}>ردیف</th>
                <th style={{ minWidth: 190 }}>کالای کاتالوگ</th>
                <th style={{ minWidth: 170 }}>نام کالا *</th>
                <th style={{ minWidth: 150 }}>مشخصات</th>
                <th style={{ width: 90 }}>سایز</th>
                <th style={{ width: 96 }}>واحد</th>
                <th style={{ width: 90 }}>مقدار</th>
                <th style={{ width: 150 }}>
                  قیمت واحد ({currency === 'RIAL' ? 'ریال' : 'تومان'}) *
                </th>
                <th style={{ width: 110 }}>مبلغ ردیف</th>
                <th style={{ width: 46 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const catalogProduct = row.productId
                  ? products.find((item) => item.id === row.productId)
                  : undefined;
                const catalogPrice = catalogProduct ? toNumber(catalogProduct.unitPrice) : 0;

                return (
                <tr key={row.key}>
                  <td className="numeric text-center">{formatNumber(index + 1, 0)}</td>
                  <td>
                    <select
                      className="select !py-1.5 text-xs"
                      value={row.productId}
                      onChange={(event) => applyProduct(row.key, event.target.value)}
                    >
                      <option value="">— انتخاب از کاتالوگ —</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input !py-1.5 text-xs"
                      value={row.productName}
                      onChange={(event) => updateRow(row.key, { productName: event.target.value })}
                      placeholder="نام کالا"
                      required
                    />
                  </td>
                  <td>
                    <input
                      className="input !py-1.5 text-xs"
                      value={row.specs}
                      onChange={(event) => updateRow(row.key, { specs: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input !py-1.5 text-xs"
                      value={row.size}
                      onChange={(event) => updateRow(row.key, { size: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="select !py-1.5 text-xs"
                      value={row.unit}
                      onChange={(event) =>
                        updateRow(row.key, { unit: event.target.value as UnitType })
                      }
                    >
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {UNIT_LABEL[unit]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <NumberField
                      className="input numeric !py-1.5 text-xs"
                      value={row.quantity}
                      onValueChange={(next) => updateRow(row.key, { quantity: next })}
                    />
                  </td>
                  <td>
                    <NumberField
                      className="input numeric !py-1.5 text-xs"
                      value={row.unitPrice}
                      placeholder="ورود قیمت واحد"
                      onValueChange={(next) => updateRow(row.key, { unitPrice: next })}
                    />
                    {catalogPrice > 0 && row.unitPrice !== catalogProduct?.unitPrice && (
                      <button
                        type="button"
                        className="numeric mt-0.5 block text-[10px] text-[#347C65] hover:underline"
                        onClick={() =>
                          updateRow(row.key, { unitPrice: catalogProduct?.unitPrice ?? '' })
                        }
                      >
                        قیمت پایه: {formatNumber(catalogPrice, 0)}
                      </button>
                    )}
                  </td>
                  <td className="numeric font-semibold">
                    {formatNumber(totals.lines[index] ?? 0, 0)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm !px-2 text-rose-700"
                      onClick={() =>
                        setRows((current) =>
                          current.length === 1
                            ? current
                            : current.filter((item) => item.key !== row.key),
                        )
                      }
                      disabled={rows.length === 1}
                      aria-label="حذف ردیف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card card-pad space-y-3 lg:col-span-2">
          <h2 className="section-title">شرایط و توضیحات</h2>
          <div>
            <label className="label" htmlFor="paymentTerms">
              شرایط پرداخت
            </label>
            <textarea
              id="paymentTerms"
              className="textarea"
              rows={2}
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="deliveryTerms">
              شرایط تحویل
            </label>
            <textarea
              id="deliveryTerms"
              className="textarea"
              rows={2}
              value={deliveryTerms}
              onChange={(event) => setDeliveryTerms(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="notes">
              توضیحات
            </label>
            <textarea
              id="notes"
              className="textarea"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <div className="card card-pad space-y-3">
          <h2 className="section-title">خلاصه مالی</h2>

          <div className="flex items-center justify-between gap-2 text-xs">
            <label htmlFor="transportCost" className="muted">
              هزینه حمل
            </label>
            <NumberField
              id="transportCost"
              className="input numeric max-w-[130px] !py-1.5 text-left"
              value={transportCost}
              onValueChange={setTransportCost}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <label htmlFor="discountAmount" className="muted">
              تخفیف
            </label>
            <NumberField
              id="discountAmount"
              className="input numeric max-w-[130px] !py-1.5 text-left"
              value={discountAmount}
              onValueChange={setDiscountAmount}
            />
          </div>

          <div className="divider" />

          <div className="flex items-center justify-between text-xs">
            <span className="muted">جمع کالاها</span>
            <span className="numeric font-semibold">
              {formatCurrency(totals.itemsSubtotal, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="muted">مالیات {includeVat ? `(${formatNumber(vatRate, 0)}٪)` : '— معاف'}</span>
            <span className="numeric font-semibold">{formatCurrency(totals.vatAmount, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="muted">هزینه حمل</span>
            <span className="numeric font-semibold">{formatCurrency(totals.transport, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="muted">تخفیف</span>
            <span className="numeric font-semibold text-rose-700">
              {formatCurrency(totals.discount, currency)}
            </span>
          </div>

          <div className="rounded-lg bg-[#F1F3F5] p-3">
            <div className="flex items-center justify-between text-sm font-extrabold">
              <span>مبلغ نهایی</span>
              <span className="numeric">{formatCurrency(totals.grandTotal, currency)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#4A5A6A]">
              {amountInWords(totals.grandTotal, currency)}
            </p>
          </div>

          <SubmitButton className="btn btn-primary w-full" pendingLabel="در حال ذخیره...">
            <Save className="h-4 w-4" />
            {submitting ? 'در حال ذخیره...' : 'ذخیره پیش‌فاکتور'}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
