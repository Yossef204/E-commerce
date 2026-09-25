import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import {
  PlusCircle,
  Trash2,
  PackagePlus,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type {
  SellingEntity,
  Category,
  Brand,
  CreateVariantInput,
} from '../../../types/vendor';

export const CreateProductPage: React.FC = () => {
  const navigate = useNavigate();
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');

  const [variants, setVariants] = useState<CreateVariantInput[]>([
    { sku: '', price: 0, initialStock: 10 },
  ]);

  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        setFetchingOptions(true);
        const [catData, brandData] = await Promise.all([
          vendorApi.getCategories(),
          vendorApi.getBrands(),
        ]);
        setCategories(catData);
        setBrands(brandData);

        if (catData.length > 0) setCategoryId(catData[0]._id);
        if (brandData.length > 0) setBrandId(brandData[0]._id);
      } catch (err: any) {
        console.error('Failed loading form options', err);
      } finally {
        setFetchingOptions(false);
      }
    };

    loadFormData();
  }, []);

  const handleAddVariant = () => {
    const nextSkuNum = variants.length + 1;
    setVariants([
      ...variants,
      { sku: `SKU-${Date.now().toString().slice(-4)}-${nextSkuNum}`, price: 100, initialStock: 10 },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) return;
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof CreateVariantInput,
    value: string | number
  ) => {
    const updated = [...variants];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setVariants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entity?._id) {
      setError('لا يوجد كيان تجاري متاح للحساب الحالي');
      return;
    }

    if (entity.status !== 'APPROVED') {
      setError('يجب أن يكون الكيان التجاري معتمداً (APPROVED) ليتمكن من إضافة المنتجات.');
      return;
    }

    if (!title.trim() || !description.trim() || !categoryId || !brandId) {
      setError('يرجى ملء كافة البيانات الأساسية (الاسم، الوصف، الفئة، والعلامة التجارية)');
      return;
    }

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.sku.trim() || v.price <= 0 || v.initialStock < 0) {
        setError(`بيانات المتغير رقم ${i + 1} غير صالحة. تأكد من إدخال SKU وسعر أكبر من صفر.`);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      await vendorApi.createProduct({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        brandId,
        sellingEntityId: entity._id,
        variants: variants.map((v) => ({
          sku: v.sku.trim(),
          price: Number(v.price),
          initialStock: Number(v.initialStock),
        })),
      });

      setSuccessMsg('تمت إضافة المنتج بنجاح! وهو الآن قيد المراجعة والاعتماد من الإدارة.');
      setTimeout(() => {
        navigate('/vendor/products');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل إرسال طلب إضافة المنتج');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingOptions) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs text-slate-500 font-semibold">جاري تحضير نموذج إنشاء المنتج...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/vendor/products"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-blue-600" />
              إضافة منتج جديد
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              قم بملء تفاصيل المنتج وتوليد المتغيرات (SKUs) والمخزون الابتدائي.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Main Basic Information */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            البيانات الأساسية للمنتج
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: حذاء رياضي كلاسيكي أسود"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الوصف التفصيلي *</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب وصفاً جذاباً ومفصلاً للمنتج وميزاته..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الفئة (Category) *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العلامة التجارية (Brand) *</label>
                <select
                  required
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {brands.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Dynamic Variant Generator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              مولد المتغيرات والأكواد (Dynamic Variant Generator)
            </h3>
            <button
              type="button"
              onClick={handleAddVariant}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> إضافة SKU آخر
            </button>
          </div>

          <div className="space-y-3">
            {variants.map((v, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    كود المتغير (SKU Code) *
                  </label>
                  <input
                    type="text"
                    required
                    value={v.sku}
                    onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                    placeholder="مثال: SHOE-BLK-42"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    السعر (ج.م) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={v.price}
                    onChange={(e) => handleVariantChange(idx, 'price', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    المخزون الابتدائي *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={v.initialStock}
                    onChange={(e) => handleVariantChange(idx, 'initialStock', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    disabled={variants.length <= 1}
                    onClick={() => handleRemoveVariant(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/vendor/products"
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            إلغاء
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ والإنشاء...</span>
              </>
            ) : (
              <span>حفظ وإرسال المنتج</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateProductPage;
