import React, { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Package, X, Save, FolderPlus } from 'lucide-react';
import {
  CurrencyType,
  Product,
  ProductCategoryDoc,
  UnitType,
  UserProfile,
} from '../types';
import { formatNumber } from '../utils/formatters';

interface ProductsViewProps {
  products: Product[];
  categories: ProductCategoryDoc[];
  currency: CurrencyType;
  currentUser: UserProfile;
  onSaveProduct: (
    product: Omit<Product, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onQuickPriceUpdate: (product: Product, newPrice: number) => Promise<void>;
  onDeleteProduct: (product: Product) => Promise<void>;
  onSaveCategory: (
    category: Omit<ProductCategoryDoc, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ) => Promise<void>;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  currency,
  currentUser,
  onSaveProduct,
  onQuickPriceUpdate,
  onDeleteProduct,
  onSaveCategory,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('همه');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Quick price inline edit
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState(0);

  // Product Form
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [factory, setFactory] = useState('');
  const [specs, setSpecs] = useState('');
  const [size, setSize] = useState('');
  const [thickness, setThickness] = useState('');
  const [length, setLength] = useState('');
  const [unit, setUnit] = useState<UnitType>('کیلوگرم');
  const [weightPerUnitKg, setWeightPerUnitKg] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Category Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'همه' && p.categoryName !== categoryFilter) return false;
      if (!q) return true;
      return [p.sku, p.name, p.factory, p.specs || '', p.size || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [products, searchQuery, categoryFilter]);

  const openNewModal = () => {
    setEditingProduct(null);
    setSku(`STL-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setFactory('');
    setSpecs('');
    setSize('');
    setThickness('');
    setLength('');
    setUnit('کیلوگرم');
    setWeightPerUnitKg(1);
    setUnitPrice(0);
    setDescription('');
    setIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setSku(p.sku);
    setName(p.name);
    setCategoryId(p.categoryId);
    setFactory(p.factory);
    setSpecs(p.specs || '');
    setSize(p.size || '');
    setThickness(p.thickness || '');
    setLength(p.length || '');
    setUnit(p.unit);
    setWeightPerUnitKg(p.weightPerUnitKg);
    setUnitPrice(p.unitPrice);
    setDescription(p.description || '');
    setIsActive(p.isActive);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !factory.trim()) {
      setFormError('نام کالا و کارخانه سازنده الزامی است.');
      return;
    }
    const cat = categories.find((c) => c.id === categoryId) || categories[0];
    if (!cat) {
      setFormError('لطفاً ابتدا حداقل یک دسته‌بندی کالا تعریف کنید.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await onSaveProduct({
        id: editingProduct?.id,
        sku: sku.trim() || 'STL-001',
        name: name.trim(),
        categoryId: cat.id,
        categoryName: cat.name,
        factory: factory.trim(),
        specs: specs.trim(),
        size: size.trim(),
        thickness: thickness.trim(),
        length: length.trim(),
        unit,
        weightPerUnitKg: Math.max(0, Number(weightPerUnitKg) || 0),
        unitPrice: Math.max(0, Number(unitPrice) || 0),
        description: description.trim(),
        isActive,
      });
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'خطا در ذخیره کالا');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await onSaveCategory({
      name: newCatName.trim(),
      description: newCatDesc.trim(),
      sortOrder: categories.length + 1,
      isActive: true,
    });
    setNewCatName('');
    setNewCatDesc('');
    setIsCatModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172535]">مدیریت کالاها و قیمت‌گذاری</h1>
          <p className="text-sm text-slate-500 mt-1">
            کاتالوگ مقاطع فولادی، مشخصات فنی و بروزرسانی قیمت واحد
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCatModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#D7DEE5] hover:bg-[#F1F3F5] text-[#172535] text-xs font-medium rounded-lg cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>دسته‌بندی جدید</span>
            </button>
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#347C65] hover:bg-[#2c6a56] text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن کالا</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو با نام کالا، کد کالا، کارخانه یا مشخصات..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-[#D7DEE5] rounded-lg focus:outline-none focus:border-[#172535]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F1F3F5] rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter('همه')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
              categoryFilter === 'همه'
                ? 'bg-white text-[#172535] shadow-sm'
                : 'text-slate-600 hover:text-[#172535]'
            }`}
          >
            همه
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.name)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                categoryFilter === cat.name
                  ? 'bg-white text-[#172535] shadow-sm'
                  : 'text-slate-600 hover:text-[#172535]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D7DEE5] rounded-xl overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="mt-3 text-sm font-medium text-[#172535]">کالایی یافت نشد</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F1F3F5]/80 text-slate-500 text-xs border-b border-[#D7DEE5]">
                <tr>
                  <th className="text-right font-medium px-4 py-3">کد کالا</th>
                  <th className="text-right font-medium px-4 py-3">نام کالا و دسته‌بندی</th>
                  <th className="text-right font-medium px-4 py-3">مشخصات / ابعاد</th>
                  <th className="text-center font-medium px-4 py-3">واحد</th>
                  <th className="text-left font-medium px-4 py-3">قیمت واحد ({currency})</th>
                  <th className="text-center font-medium px-4 py-3">وضعیت</th>
                  {isAdmin && <th className="text-center font-medium px-4 py-3">عملیات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-[#F1F3F5]/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono-num text-xs font-medium text-slate-700 whitespace-nowrap">
                      {product.sku}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[#172535]">{product.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {product.categoryName} · {product.factory}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div>{[product.specs, product.size].filter(Boolean).join(' · ') || '—'}</div>
                      {(product.thickness || product.length) && (
                        <div className="text-slate-400 mt-0.5">
                          {[product.thickness && `ضخامت: ${product.thickness}`, product.length && `طول: ${product.length}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-slate-700 whitespace-nowrap">
                      {product.unit}
                    </td>
                    <td className="px-4 py-3.5 text-left whitespace-nowrap">
                      {isAdmin && editingPriceId === product.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(Number(e.target.value))}
                            className="w-28 px-2 py-1 text-xs text-left tabular-nums border border-[#172535] rounded-md"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void onQuickPriceUpdate(product, Math.max(0, priceDraft));
                              setEditingPriceId(null);
                            }}
                            className="px-2 py-1 text-xs bg-[#347C65] text-white rounded-md cursor-pointer"
                          >
                            ثبت
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => {
                            if (!isAdmin) return;
                            setEditingPriceId(product.id);
                            setPriceDraft(product.unitPrice);
                          }}
                          className={`font-bold text-[#172535] tabular-nums ${
                            isAdmin ? 'hover:text-[#347C65] cursor-pointer' : ''
                          }`}
                        >
                          {formatNumber(product.unitPrice)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs">
                      <span className={product.isActive ? 'text-[#347C65] font-medium' : 'text-slate-400'}>
                        {product.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5">
                        {confirmDeleteId === product.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                void onDeleteProduct(product);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 text-xs font-medium bg-rose-600 text-white rounded-md cursor-pointer"
                            >
                              حذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              لغو
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="p-1.5 text-slate-600 hover:text-[#172535] hover:bg-[#F1F3F5] rounded-md cursor-pointer"
                              title="ویرایش"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#172535]/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#D7DEE5] rounded-xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#172535] text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingProduct ? 'ویرایش مشخصات کالا' : 'تعریف کالای جدید'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">نام کالا *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">کد کالا</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-sm font-mono-num border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">دسته‌بندی *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">کارخانه سازنده *</label>
                  <input
                    type="text"
                    value={factory}
                    onChange={(e) => setFactory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">مشخصات فنی / گرید</label>
                  <input
                    type="text"
                    value={specs}
                    onChange={(e) => setSpecs(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">سایز</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">ضخامت</label>
                  <input
                    type="text"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">طول</label>
                  <input
                    type="text"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">واحد اندازه‌گیری</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as UnitType)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg bg-white"
                  >
                    <option value="کیلوگرم">کیلوگرم</option>
                    <option value="شاخه">شاخه</option>
                    <option value="متر">متر</option>
                    <option value="برگ">برگ</option>
                    <option value="تن">تن</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    وزن هر واحد (کیلوگرم)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={weightPerUnitKg}
                    onChange={(e) => setWeightPerUnitKg(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172535] mb-1">
                    قیمت واحد ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="100"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm tabular-nums border border-[#D7DEE5] rounded-lg"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-sm text-[#172535] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span>کالا در کاتالوگ فعال باشد</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#172535] mb-1">توضیحات</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#D7DEE5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#347C65] hover:bg-[#2c6a56] text-white rounded-lg cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'در حال ذخیره...' : 'ذخیره کالا'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#172535]/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7DEE5] rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 bg-[#172535] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">افزودن دسته‌بندی جدید کالا</h3>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="p-1 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreateCategory(e)} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#172535] mb-1">نام دسته‌بندی *</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172535] mb-1">توضیحات</label>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D7DEE5] rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-[#347C65] text-white rounded-lg cursor-pointer"
                >
                  ثبت دسته‌بندی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
