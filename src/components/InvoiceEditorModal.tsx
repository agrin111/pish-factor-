import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Save, Send } from 'lucide-react';
import {
  CompanySettings,
  Customer,
  Product,
  Quotation,
  QuotationStatus,
  UnitType,
} from '../types';
import {
  calculateLineTotal,
  calculateQuotationTotals,
  formatCurrency,
  formatNumber,
  getShamsiDate,
  numberToPersianWords,
} from '../utils/formatters';
import { fetchQuotationItems } from '../services/firestoreService';

interface DraftItemRow {
  tempId: string;
  productId: string;
  sku: string;
  productName: string;
  specs: string;
  size: string;
  unit: UnitType;
  quantity: number;
  weightPerUnitKg: number;
  unitPrice: number;
}

interface InvoiceEditorModalProps {
  existingQuotation: Quotation | null;
  duplicateSource?: Quotation | null;
  customers: Customer[];
  products: Product[];
  companySettings: CompanySettings;
  onSubmit: (payload: {
    existingQuotation: Quotation | null;
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
    items: Omit<DraftItemRow, 'tempId'>[];
  }) => Promise<void>;
  onClose: () => void;
}

export const InvoiceEditorModal: React.FC<InvoiceEditorModalProps> = ({
  existingQuotation,
  duplicateSource,
  customers,
  products,
  companySettings,
  onSubmit,
  onClose,
}) => {
  const source = existingQuotation || duplicateSource || null;
  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const [customerId, setCustomerId] = useState(source?.customerId || customers[0]?.id || '');
  const [issueDateShamsi, setIssueDateShamsi] = useState(
    existingQuotation?.issueDateShamsi || getShamsiDate()
  );
  const [validDays, setValidDays] = useState(
    source?.validDays ?? companySettings.defaultValidDays
  );
  const [includeVat, setIncludeVat] = useState(
    source?.includeVat ?? companySettings.defaultIncludeVat
  );
  const [vatRate, setVatRate] = useState(
    source?.vatRate ?? companySettings.defaultVatRate
  );
  const [transportCost, setTransportCost] = useState(source?.transportCost ?? 0);
  const [discountAmount, setDiscountAmount] = useState(source?.discountAmount ?? 0);
  const [paymentTerms, setPaymentTerms] = useState(
    source?.paymentTerms ?? (companySettings.defaultPaymentTerms || '')
  );
  const [deliveryTerms, setDeliveryTerms] = useState(
    source?.deliveryTerms ?? (companySettings.defaultDeliveryTerms || '')
  );
  const [notes, setNotes] = useState(
    source?.notes ?? (companySettings.defaultNotes || '')
  );

  const [items, setItems] = useState<DraftItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(Boolean(source));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (source) {
        try {
          const fetched = await fetchQuotationItems(source.id);
          if (!active) return;
          setItems(
            fetched.map((it) => ({
              tempId: it.id,
              productId: it.productId || '',
              sku: it.sku || '',
              productName: it.productName,
              specs: it.specs || '',
              size: it.size || '',
              unit: it.unit,
              quantity: it.quantity,
              weightPerUnitKg: it.weightPerUnitKg,
              unitPrice: it.unitPrice,
            }))
          );
        } catch {
          if (active) setErrorMsg('بارگذاری اقلام پیش‌فاکتور با خطا مواجه شد.');
        } finally {
          if (active) setLoadingItems(false);
        }
      } else {
        const first = activeProducts[0];
        setItems(
          first
            ? [
                {
                  tempId: `row_${Date.now()}`,
                  productId: first.id,
                  sku: first.sku,
                  productName: first.name,
                  specs: [first.factory, first.specs].filter(Boolean).join(' - '),
                  size: first.size || '',
                  unit: first.unit,
                  quantity: first.unit === 'کیلوگرم' ? 1000 : 10,
                  weightPerUnitKg: first.weightPerUnitKg,
                  unitPrice: first.unitPrice,
                },
              ]
            : []
        );
        setLoadingItems(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [source, activeProducts]);

  const totals = useMemo(
    () =>
      calculateQuotationTotals(
        items,
        includeVat,
        vatRate,
        transportCost,
        discountAmount
      ),
    [items, includeVat, vatRate, transportCost, discountAmount]
  );

  const handleAddCatalogRow = () => {
    const first = activeProducts[0];
    setItems((prev) => [
      ...prev,
      {
        tempId: `row_${Date.now()}_${Math.random()}`,
        productId: first?.id || '',
        sku: first?.sku || '',
        productName: first?.name || '',
        specs: first ? [first.factory, first.specs].filter(Boolean).join(' - ') : '',
        size: first?.size || '',
        unit: first?.unit || 'کیلوگرم',
        quantity: first?.unit === 'کیلوگرم' ? 1000 : 1,
        weightPerUnitKg: first?.weightPerUnitKg ?? 1,
        unitPrice: first?.unitPrice ?? 0,
      },
    ]);
  };

  const handleAddCustomRow = () => {
    setItems((prev) => [
      ...prev,
      {
        tempId: `custom_${Date.now()}_${Math.random()}`,
        productId: '',
        sku: 'CUSTOM',
        productName: '',
        specs: '',
        size: '',
        unit: 'کیلوگرم',
        quantity: 1,
        weightPerUnitKg: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleSelectProduct = (tempId: string, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setItems((prev) =>
      prev.map((row) =>
        row.tempId === tempId
          ? {
              ...row,
              productId: prod.id,
              sku: prod.sku,
              productName: prod.name,
              specs: [prod.factory, prod.specs].filter(Boolean).join(' - '),
              size: prod.size || '',
              unit: prod.unit,
              weightPerUnitKg: prod.weightPerUnitKg,
              unitPrice: prod.unitPrice,
            }
          : row
      )
    );
  };

  const handleUpdateRow = <K extends keyof DraftItemRow>(
    tempId: string,
    field: K,
    value: DraftItemRow[K]
  ) => {
    setItems((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveRow = (tempId: string) => {
    setItems((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleSave = async (targetStatus: QuotationStatus) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      setErrorMsg('لطفاً یک مشتری را انتخاب کنید.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('حداقل یک ردیف کالا باید ثبت شود.');
      return;
    }
    const invalidRow = items.find((i) => !i.productName.trim() || i.quantity <= 0);
    if (invalidRow) {
      setErrorMsg('نام کالا و مقدار مثبت برای تمام ردیف‌ها الزامی است.');
      return;
    }

    setErrorMsg('');
    setSaving(true);
    try {
      await onSubmit({
        existingQuotation,
        customer,
        issueDateShamsi,
        validDays,
        status: targetStatus,
        currency: companySettings.currency,
        includeVat,
        vatRate,
        transportCost,
        discountAmount,
        paymentTerms,
        deliveryTerms,
        notes,
        items: items.map(({ tempId: _ignored, ...rest }) => rest),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ذخیره پیش‌فاکتور');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172535]/65 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-[#D7DEE5] rounded-xl w-full max-w-6xl max-h-[93vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#172535] text-white rounded-t-xl flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold">
              {existingQuotation
                ? `ویرایش پیش‌فاکتور ${existingQuotation.quotationNumber}`
                : duplicateSource
                  ? `صدور پیش‌فاکتور جدید (کپی از ${duplicateSource.quotationNumber})`
                  : 'صدور پیش‌فاکتور جدید'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              قیمت و مشخصات کالاها به‌صورت Snapshot در ردیف پیش‌فاکتور ذخیره می‌شوند
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-[#172535] mb-1.5">
                انتخاب مشتری *
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg bg-white focus:outline-none focus:border-[#172535]"
              >
                <option value="">انتخاب مشتری...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyOrProject ? `${c.companyOrProject} (${c.name})` : c.name} — {c.mobile}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172535] mb-1.5">
                تاریخ صدور (شمسی)
              </label>
              <input
                type="text"
                value={issueDateShamsi}
                onChange={(e) => setIssueDateShamsi(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg focus:outline-none focus:border-[#172535]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172535] mb-1.5">
                مدت اعتبار پیش‌فاکتور (روز)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg focus:outline-none focus:border-[#172535]"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-[#D7DEE5] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#F1F3F5] border-b border-[#D7DEE5] flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-[#172535]">
                اقلام پیش‌فاکتور ({formatNumber(items.length)} ردیف)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCustomRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#D7DEE5] bg-white hover:bg-slate-50 text-[#172535] rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ردیف دلخواه</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCatalogRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#172535] hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن از کاتالوگ</span>
                </button>
              </div>
            </div>

            {loadingItems ? (
              <div className="p-8 text-center text-sm text-slate-500">در حال بارگذاری اقلام...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-[#D7DEE5]">
                    <tr>
                      <th className="text-center font-medium px-2 py-2.5 w-10">ردیف</th>
                      <th className="text-right font-medium px-3 py-2.5 min-w-[240px]">کالا و مشخصات</th>
                      <th className="text-right font-medium px-2 py-2.5 w-28">سایز</th>
                      <th className="text-right font-medium px-2 py-2.5 w-24">واحد</th>
                      <th className="text-right font-medium px-2 py-2.5 w-24">مقدار</th>
                      <th className="text-right font-medium px-2 py-2.5 w-32">
                        قیمت واحد ({companySettings.currency})
                      </th>
                      <th className="text-left font-medium px-3 py-2.5 w-32">مبلغ کل ردیف</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((row, idx) => {
                      const rowTotal = calculateLineTotal(row.quantity, row.unitPrice);
                      return (
                        <tr key={row.tempId} className="align-top">
                          <td className="px-2 py-3 text-center text-slate-400 tabular-nums">
                            {formatNumber(idx + 1)}
                          </td>
                          <td className="px-3 py-2.5 space-y-1.5">
                            {activeProducts.length > 0 && (
                              <select
                                value={row.productId}
                                onChange={(e) => handleSelectProduct(row.tempId, e.target.value)}
                                className="w-full px-2 py-1.5 border border-[#D7DEE5] rounded-md bg-white"
                              >
                                <option value="">-- ردیف آزاد / انتخاب از کاتالوگ --</option>
                                {activeProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.factory} - {p.size || p.unit})
                                  </option>
                                ))}
                              </select>
                            )}
                            <input
                              type="text"
                              value={row.productName}
                              onChange={(e) =>
                                handleUpdateRow(row.tempId, 'productName', e.target.value)
                              }
                              placeholder="نام کالا *"
                              className="w-full px-2 py-1 border border-[#D7DEE5] rounded-md"
                            />
                            <input
                              type="text"
                              value={row.specs}
                              onChange={(e) =>
                                handleUpdateRow(row.tempId, 'specs', e.target.value)
                              }
                              placeholder="مشخصات فنی / کارخانه سازنده"
                              className="w-full px-2 py-1 border border-[#D7DEE5] rounded-md text-slate-600"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="text"
                              value={row.size}
                              onChange={(e) =>
                                handleUpdateRow(row.tempId, 'size', e.target.value)
                              }
                              placeholder="سایز"
                              className="w-full px-2 py-1.5 border border-[#D7DEE5] rounded-md"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <select
                              value={row.unit}
                              onChange={(e) =>
                                handleUpdateRow(row.tempId, 'unit', e.target.value as UnitType)
                              }
                              className="w-full px-2 py-1.5 border border-[#D7DEE5] rounded-md bg-white"
                            >
                              <option value="کیلوگرم">کیلوگرم</option>
                              <option value="شاخه">شاخه</option>
                              <option value="متر">متر</option>
                              <option value="برگ">برگ</option>
                              <option value="تن">تن</option>
                            </select>
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min={0.01}
                              step="any"
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateRow(row.tempId, 'quantity', Number(e.target.value))
                              }
                              className="w-full px-2 py-1.5 tabular-nums border border-[#D7DEE5] rounded-md"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step="100"
                              value={row.unitPrice}
                              onChange={(e) =>
                                handleUpdateRow(row.tempId, 'unitPrice', Number(e.target.value))
                              }
                              className="w-full px-2 py-1.5 tabular-nums border border-[#D7DEE5] rounded-md"
                            />
                          </td>
                          <td className="px-3 py-3 text-left font-bold text-[#172535] tabular-nums whitespace-nowrap">
                            {formatNumber(rowTotal)}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.tempId)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="حذف ردیف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Terms & Financial Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#172535] mb-1">
                  شرایط پرداخت
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172535] mb-1">
                  شرایط و محل تحویل
                </label>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172535] mb-1">
                  توضیحات پیش‌فاکتور
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                />
              </div>
            </div>

            <div className="bg-[#F1F3F5] border border-[#D7DEE5] rounded-xl p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">جمع کل کالاها:</span>
                <span className="font-semibold text-[#172535] tabular-nums">
                  {formatCurrency(totals.itemsSubtotal, companySettings.currency)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="text-slate-600 shrink-0">
                  هزینه حمل ({companySettings.currency}):
                </label>
                <input
                  type="number"
                  min={0}
                  step="50000"
                  value={transportCost}
                  onChange={(e) => setTransportCost(Number(e.target.value))}
                  className="w-40 px-2.5 py-1.5 text-sm text-left tabular-nums bg-white border border-[#D7DEE5] rounded-md"
                />
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="text-slate-600 shrink-0">
                  تخفیف ({companySettings.currency}):
                </label>
                <input
                  type="number"
                  min={0}
                  step="50000"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-40 px-2.5 py-1.5 text-sm text-left tabular-nums bg-white border border-[#D7DEE5] rounded-md"
                />
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeVat}
                    onChange={(e) => setIncludeVat(e.target.checked)}
                    className="rounded border-[#D7DEE5]"
                  />
                  <span>مالیات بر ارزش افزوده (٪)</span>
                </label>
                <div className="flex items-center gap-2">
                  {includeVat && (
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs text-center tabular-nums bg-white border border-[#D7DEE5] rounded-md"
                    />
                  )}
                  <span className="font-medium text-[#172535] tabular-nums">
                    {formatCurrency(totals.vatAmount, companySettings.currency)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#D7DEE5] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#172535]">مبلغ نهایی:</span>
                  <span className="text-lg font-extrabold text-[#172535] tabular-nums">
                    {formatCurrency(totals.grandTotal, companySettings.currency)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 pt-1">
                  به حروف: {numberToPersianWords(totals.grandTotal)} {companySettings.currency}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#D7DEE5] flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('پیش‌نویس')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[#D7DEE5] bg-white hover:bg-[#F1F3F5] text-[#172535] rounded-lg cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره پیش‌نویس</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('ارسال‌شده')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#347C65] hover:bg-[#2c6a56] text-white rounded-lg cursor-pointer disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{saving ? 'در حال ثبت...' : 'ثبت نهایی و صدور پیش‌فاکتور'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
