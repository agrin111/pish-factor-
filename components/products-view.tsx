'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  deleteCategoryAction,
  deleteProductAction,
  saveCategoryAction,
  saveProductAction,
  toggleProductActiveAction,
} from '@/actions/products';
import { initialActionState } from '@/lib/forms';
import { Modal } from '@/components/modal';
import { SubmitButton } from '@/components/submit-button';
import { formatCurrency, formatNumber, formatPersianText, toPersianDigits } from '@/lib/format';
import { NumberField } from '@/components/number-field';
import { UNIT_LABEL, UNITS } from '@/lib/labels';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  factory: string | null;
  specs: string | null;
  size: string | null;
  thickness: string | null;
  length: string | null;
  unit: keyof typeof UNIT_LABEL;
  weightPerUnitKg: string;
  unitPrice: string;
  description: string | null;
  isActive: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

interface Props {
  products: ProductRow[];
  categories: CategoryRow[];
  currency: string;
  isAdmin: boolean;
}

export function ProductsView({ products, categories, currency, isAdmin }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [categoryFormKey, setCategoryFormKey] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [state, formAction] = useActionState(saveProductAction, initialActionState);
  const [categoryState, categoryAction] = useActionState(saveCategoryAction, initialActionState);
  const [deleteCategoryState, deleteCategoryActionState] = useActionState(
    deleteCategoryAction,
    initialActionState,
  );
  const [toggleState, toggleAction] = useActionState(toggleProductActiveAction, initialActionState);
  const [deleteState, deleteAction] = useActionState(deleteProductAction, initialActionState);

  const [dismissedSave, setDismissedSave] = useState(initialActionState);
  const [dismissedCategory, setDismissedCategory] = useState(initialActionState);
  const [dismissedDeleteCategory, setDismissedDeleteCategory] = useState(initialActionState);
  const [dismissedDelete, setDismissedDelete] = useState(initialActionState);

  const visibleState = state !== dismissedSave ? state : initialActionState;
  const visibleCategoryState =
    categoryState !== dismissedCategory ? categoryState : initialActionState;
  const visibleDeleteCategoryState =
    deleteCategoryState !== dismissedDeleteCategory ? deleteCategoryState : initialActionState;
  const visibleDeleteState = deleteState !== dismissedDelete ? deleteState : initialActionState;

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setEditing(null);
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (categoryState.ok) {
      setEditingCategory(null);
      setCategoryFormKey((prev) => prev + 1);
      router.refresh();
    }
  }, [categoryState, router]);

  useEffect(() => {
    if (deleteCategoryState.ok) {
      setEditingCategory(null);
      router.refresh();
    }
  }, [deleteCategoryState, router]);

  useEffect(() => {
    if (toggleState.ok || deleteState.ok) {
      setConfirmId(null);
      router.refresh();
    }
  }, [toggleState, deleteState, router]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter && product.categoryId !== categoryFilter) return false;
      if (statusFilter === 'ACTIVE' && !product.isActive) return false;
      if (statusFilter === 'INACTIVE' && product.isActive) return false;
      if (!term) return true;
      return [
        product.name,
        product.sku,
        product.specs,
        product.size,
        product.thickness,
        product.length,
        product.factory,
        product.categoryName,
        product.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [products, query, categoryFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="مدیریت کالا و قیمت"
        description="کاتالوگ کالاهای فولادی با مشخصات فنی و قیمت واحد؛ قیمت‌های ثبت‌شده در پیش‌فاکتور به‌صورت Snapshot حفظ می‌شوند."
        actions={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDismissedCategory(categoryState);
                setDismissedDeleteCategory(deleteCategoryState);
                setEditingCategory(null);
                setCategoryOpen(true);
              }}
            >
              <Layers className="h-4 w-4" />
              مدیریت دسته‌بندی‌ها
            </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDismissedSave(state);
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                افزودن کالا
              </button>
            </div>
          ) : null
        }
      />

      <div className="card card-pad flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input pr-9"
            placeholder="جستجوی نام کالا، کد کالا، سایز یا کارخانه..."
            aria-label="جستجوی کالا"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="select max-w-[200px]"
          aria-label="فیلتر دسته‌بندی"
        >
          <option value="">همه دسته‌بندی‌ها</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          className="select max-w-[150px]"
          aria-label="فیلتر وضعیت کالا"
        >
          <option value="ALL">همه وضعیت‌ها</option>
          <option value="ACTIVE">فقط فعال</option>
          <option value="INACTIVE">فقط غیرفعال</option>
        </select>
        <span className="muted numeric text-xs">
          {formatNumber(filtered.length, 0)} کالا
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="کالایی یافت نشد"
          hint={
            products.length === 0
              ? 'برای شروع، اولین کالا را تعریف کنید.'
              : 'عبارت جستجو یا فیلترها را تغییر دهید.'
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>کالا</th>
                <th>کد</th>
                <th>دسته‌بندی / برند</th>
                <th>مشخصات</th>
                <th>واحد / وزن</th>
                <th>قیمت واحد</th>
                <th>وضعیت</th>
                {isAdmin && <th>عملیات</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td className="font-semibold">
                    {formatPersianText(product.name)}
                    {product.description && (
                      <div className="muted mt-0.5 max-w-[220px] truncate text-[11px] font-normal">
                        {formatPersianText(product.description)}
                      </div>
                    )}
                  </td>
                  <td className="numeric" dir="ltr">
                    {toPersianDigits(product.sku)}
                  </td>
                  <td>
                    <div>{product.categoryName ? formatPersianText(product.categoryName) : '—'}</div>
                    {product.factory && (
                      <div className="muted mt-0.5 text-[11px]">
                        {formatPersianText(product.factory)}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[240px]">
                    <span className="muted line-clamp-2 text-[11px]">
                      {[product.size, product.thickness, product.length, product.specs]
                        .filter(Boolean)
                        .map((part) => formatPersianText(part))
                        .join(' · ') || '—'}
                    </span>
                  </td>
                  <td>
                    <div>{UNIT_LABEL[product.unit]}</div>
                    {Number(product.weightPerUnitKg) > 0 && (
                      <div className="muted numeric mt-0.5 text-[11px]">
                        {formatNumber(product.weightPerUnitKg, 3)} ک‌گ
                      </div>
                    )}
                  </td>
                  <td className="numeric">
                    {Number(product.unitPrice) > 0 ? (
                      formatCurrency(product.unitPrice, currency)
                    ) : (
                      <span className="muted text-[11px]">ورود در پیش‌فاکتور</span>
                    )}
                  </td>
                  <td>
                    {product.isActive ? (
                      <span className="badge badge-green">فعال</span>
                    ) : (
                      <span className="badge badge-gray">غیرفعال</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setDismissedSave(state);
                            setEditing(product);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          ویرایش
                        </button>
                        <form action={toggleAction}>
                          <input type="hidden" name="id" value={product.id} />
                          <input type="hidden" name="isActive" value={String(!product.isActive)} />
                          <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="...">
                            {product.isActive ? 'غیرفعال' : 'فعال'}
                          </SubmitButton>
                        </form>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            setDismissedDelete(deleteState);
                            setConfirmId(product.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        wide
        title={editing ? `ویرایش کالا ${editing.name}` : 'افزودن کالای جدید'}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <form key={editing?.id ?? 'new'} action={formAction} className="space-y-3">
          {editing && <input type="hidden" name="id" value={editing.id} />}

          {visibleState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                visibleState.ok
                  ? 'alert-success'
                  : 'alert-danger'
              }`}
            >
              {visibleState.message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="sku">
                کد کالا *
              </label>
              <input
                id="sku"
                name="sku"
                className="input"
                dir="ltr"
                defaultValue={editing?.sku ?? ''}
                required
              />
              {visibleState.errors?.sku && (
                <p className="field-error">{visibleState.errors.sku[0]}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">
                نام کالا *
              </label>
              <input
                id="name"
                name="name"
                className="input"
                defaultValue={editing?.name ?? ''}
                required
              />
              {visibleState.errors?.name && (
                <p className="field-error">{visibleState.errors.name[0]}</p>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="label !mb-0" htmlFor="categoryId">
                  دسته‌بندی
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-accent-600 hover:underline"
                    onClick={() => {
                      setDismissedCategory(categoryState);
                      setDismissedDeleteCategory(deleteCategoryState);
                      setEditingCategory(null);
                      setCategoryOpen(true);
                    }}
                  >
                    + دسته جدید
                  </button>
                )}
              </div>
              <select
                id="categoryId"
                name="categoryId"
                className="select"
                defaultValue={editing?.categoryId ?? ''}
              >
                <option value="">بدون دسته‌بندی</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="factory">
                کارخانه / برند
              </label>
              <input
                id="factory"
                name="factory"
                className="input"
                defaultValue={editing?.factory ?? ''}
              />
            </div>

            <div>
              <label className="label" htmlFor="unit">
                واحد اندازه‌گیری
              </label>
              <select id="unit" name="unit" className="select" defaultValue={editing?.unit ?? 'KILOGRAM'}>
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="size">
                سایز
              </label>
              <input id="size" name="size" className="input" defaultValue={editing?.size ?? ''} />
            </div>

            <div>
              <label className="label" htmlFor="thickness">
                ضخامت
              </label>
              <input
                id="thickness"
                name="thickness"
                className="input"
                defaultValue={editing?.thickness ?? ''}
              />
            </div>

            <div>
              <label className="label" htmlFor="length">
                طول
              </label>
              <input
                id="length"
                name="length"
                className="input"
                defaultValue={editing?.length ?? ''}
              />
            </div>

            <div>
              <label className="label" htmlFor="weightPerUnitKg">
                وزن هر واحد (کیلوگرم)
              </label>
              <NumberField
                id="weightPerUnitKg"
                name="weightPerUnitKg"
                className="input numeric"
                defaultValue={editing?.weightPerUnitKg ?? '0'}
              />
            </div>

            <div>
              <label className="label" htmlFor="unitPrice">
                قیمت واحد پایه ({currency === 'RIAL' ? 'ریال' : 'تومان'} — اختیاری)
              </label>
              <NumberField
                id="unitPrice"
                name="unitPrice"
                className="input numeric"
                defaultValue={editing?.unitPrice ?? '0'}
              />
              <p className="field-hint">قیمت هر کالا در زمان صدور هر پیش‌فاکتور وارد می‌شود.</p>
              {visibleState.errors?.unitPrice && (
                <p className="field-error">{visibleState.errors.unitPrice[0]}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="specs">
              مشخصات فنی
            </label>
            <textarea
              id="specs"
              name="specs"
              className="textarea"
              rows={2}
              defaultValue={editing?.specs ?? ''}
            />
          </div>

          <div>
            <label className="label" htmlFor="description">
              توضیحات
            </label>
            <textarea
              id="description"
              name="description"
              className="textarea"
              rows={2}
              defaultValue={editing?.description ?? ''}
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing ? editing.isActive : true}
              className="h-4 w-4"
            />
            کالا فعال است و در فرم صدور پیش‌فاکتور نمایش داده شود
          </label>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              انصراف
            </button>
            <SubmitButton className="btn btn-primary">
              {editing ? 'ذخیره تغییرات' : 'ثبت کالا'}
            </SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={categoryOpen}
        title={editingCategory ? `ویرایش دسته‌بندی «${editingCategory.name}»` : 'مدیریت دسته‌بندی کالاها'}
        onClose={() => {
          setCategoryOpen(false);
          setEditingCategory(null);
        }}
      >
        <form
          key={`${editingCategory?.id ?? 'new'}-${categoryFormKey}`}
          action={categoryAction}
          className="space-y-3"
        >
          {editingCategory && <input type="hidden" name="id" value={editingCategory.id} />}
          {visibleCategoryState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                visibleCategoryState.ok
                  ? 'alert-success'
                  : 'alert-danger'
              }`}
            >
              {visibleCategoryState.message}
            </div>
          )}
          {visibleDeleteCategoryState.message && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                visibleDeleteCategoryState.ok
                  ? 'alert-success'
                  : 'alert-danger'
              }`}
            >
              {visibleDeleteCategoryState.message}
            </div>
          )}
          <div>
            <label className="label" htmlFor="cat-name">
              نام دسته‌بندی *
            </label>
            <input
              id="cat-name"
              name="name"
              className="input"
              placeholder="مثلاً: مصالح ساختمانی"
              defaultValue={editingCategory?.name ?? ''}
              required
            />
            {visibleCategoryState.errors?.name && (
              <p className="field-error">{visibleCategoryState.errors.name[0]}</p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="cat-sort">
              ترتیب نمایش
            </label>
            <NumberField
              id="cat-sort"
              name="sortOrder"
              className="input numeric"
              allowDecimal={false}
              defaultValue={
                editingCategory ? String(editingCategory.sortOrder) : String(categories.length + 1)
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingCategory ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingCategory(null)}
              >
                لغو ویرایش
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setCategoryOpen(false)}>
                بستن
              </button>
            )}
            <SubmitButton className="btn btn-primary">
              {editingCategory ? 'ذخیره تغییرات' : 'افزودن دسته‌بندی'}
            </SubmitButton>
          </div>
        </form>

        {categories.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <h4 className="mb-2 text-xs font-semibold">دسته‌بندی‌های موجود ({formatNumber(categories.length, 0)})</h4>
            <ul className="max-h-60 divide-y divide-line overflow-y-auto text-xs">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{category.name}</span>
                    <span className="muted numeric text-[11px]">
                      ({formatNumber(category.productCount, 0)} کالا)
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm !px-2"
                      onClick={() => setEditingCategory(category)}
                      title="ویرایش دسته‌بندی"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {category.productCount === 0 && (
                      <form action={deleteCategoryActionState}>
                        <input type="hidden" name="id" value={category.id} />
                        <SubmitButton
                          className="btn btn-ghost btn-sm !px-2 !text-danger"
                          pendingLabel="..."
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(confirmId)} title="حذف کالا" onClose={() => setConfirmId(null)}>
        <form action={deleteAction} className="space-y-4">
          <input type="hidden" name="id" value={confirmId ?? ''} />
          {visibleDeleteState.message && (
            <div className="alert alert-danger">
              {visibleDeleteState.message}
            </div>
          )}
          <p className="text-sm leading-relaxed">
            آیا از حذف این کالا اطمینان دارید؟ کالاهایی که در پیش‌فاکتور استفاده شده‌اند حذف نمی‌شوند و
            باید غیرفعال شوند.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmId(null)}>
              انصراف
            </button>
            <SubmitButton className="btn btn-danger">حذف کالا</SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
