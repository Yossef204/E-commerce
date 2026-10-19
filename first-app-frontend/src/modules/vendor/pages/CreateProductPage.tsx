import React, { useEffect, useState, useRef } from 'react';
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
  UploadCloud,
  Image as ImageIcon,
  Lock,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import vendorApi from '../../../api/vendorApi';
import uploadApi from '../../../api/uploadApi';
import type {
  SellingEntity,
  Category,
  CreateVariantInput,
} from '../../../types/vendor';

export const CreateProductPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { entity: outletEntity } = useOutletContext<{ entity: SellingEntity | null }>();

  const [entity, setEntity] = useState<SellingEntity | null>(outletEntity || null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetchingOptions, setFetchingOptions] = useState(true);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<CreateVariantInput[]>([
    { sku: '', price: 100, initialStock: 10 },
  ]);

  // Upload & UI Status
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Categories and ensure Entity profile with Brand is loaded
  useEffect(() => {
    let isMounted = true;

    const loadFormData = async () => {
      try {
        setFetchingOptions(true);
        setError(null);

        // Fetch categories list
        const catData = await vendorApi.getCategories();
        if (isMounted) {
          const safeCategories = Array.isArray(catData) ? catData : [];
          setCategories(safeCategories);
          if (safeCategories.length > 0) {
            setCategoryId(safeCategories[0]._id);
          }
        }

        // Ensure SellingEntity with Brand is loaded
        if (user?.id && (!outletEntity || !outletEntity.brand)) {
          try {
            const profile = await vendorApi.getProfile(user.id);
            if (isMounted && profile) {
              setEntity(profile);
            }
          } catch (profileErr) {
            console.error('Failed fetching vendor profile:', profileErr);
          }
        } else if (outletEntity && isMounted) {
          setEntity(outletEntity);
        }
      } catch (err: any) {
        console.error('Failed loading form options:', err);
        if (isMounted) {
          setError('تعذر تحميل خيارات التصنيفات. يرجى إعادة المحاولة.');
        }
      } finally {
        if (isMounted) {
          setFetchingOptions(false);
        }
      }
    };

    loadFormData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, outletEntity]);

  // Brand Info (Locked for IDOR Security)
  const lockedBrandName =
    entity?.brand?.name ||
    entity?.legalName ||
    entity?.tradeName ||
    'العلامة التجارية المعتمدة للكيان';
  const lockedBrandId = entity?.brand?._id || entity?._id || '';

  // File Selector & S3 Presigned URL Upload Lifecycle
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.type)) {
        setError(`الملف "${file.name}" غير مدعوم. الصيغ المسموحة هي JPG، PNG، WEBP.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`الملف "${file.name}" حجمه كبير جداً. الحد الأقصى 5 ميجابايت.`);
        return;
      }
      validFiles.push(file);
    }

    try {
      setUploadingImages(true);
      setError(null);
      const uploadedUrls: string[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgress(`جاري رفع الصورة (${i + 1} من ${validFiles.length}): ${file.name}...`);
        const fileUrl = await uploadApi.uploadFile(file, 'products');
        uploadedUrls.push(fileUrl);
      }

      setImages((prev) => [...prev, ...uploadedUrls]);
      setSuccessMsg(`تم رفع ${uploadedUrls.length} صورة بنجاح!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (uploadErr: any) {
      console.error('Error uploading files via presigned URL:', uploadErr);
      setError(
        uploadErr.message ||
          'فشل رفع بعض أو كل الصور إلى الخادم السحابي. يرجى التحقق من اتصالك والمحاولة مجدداً.'
      );
    } finally {
      setUploadingImages(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Variant generator handlers
  const handleAddVariant = () => {
    const nextSkuNum = variants.length + 1;
    setVariants([
      ...variants,
      {
        sku: `SKU-${Date.now().toString().slice(-4)}-${nextSkuNum}`,
        price: 100,
        initialStock: 10,
      },
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

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!entity?._id) {
      setError('لا يوجد كيان تجاري متاح للحساب الحالي.');
      return;
    }

    if (entity.status !== 'APPROVED' && entity.status !== 'ACTIVE') {
      setError(
        'يجب أن يكون الكيان التجاري معتمداً (APPROVED أو ACTIVE) ليتمكن من إضافة المنتجات.'
      );
      return;
    }

    if (!title.trim() || !description.trim() || !categoryId) {
      setError('يرجى ملء كافة البيانات الأساسية (اسم المنتج، الوصف، واختيار القسم).');
      return;
    }

    if (images.length === 0) {
      setError('يرجى رفع صورة واحدة على الأقل للمنتج.');
      return;
    }

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.sku.trim() || v.price <= 0 || v.initialStock < 0) {
        setError(
          `بيانات المتغير رقم ${i + 1} غير صالحة. تأكد من إدخال كود SKU وسعر أكبر من صفر.`
        );
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
        brandId: lockedBrandId,
        sellingEntityId: entity._id,
        images,
        image: images[0] || '',
        variants: variants.map((v) => ({
          sku: v.sku.trim(),
          price: Number(v.price),
          initialStock: Number(v.initialStock),
        })),
      });

      setSuccessMsg(
        'تمت إضافة المنتج بنجاح! وهو الآن بانتظار مراجعة واعتماد الإدارة.'
      );
      setTimeout(() => {
        navigate('/vendor/products');
      }, 1500);
    } catch (err: any) {
      console.error('Create product failed:', err);
      setError(
        err.response?.data?.message ||
          'فشل إرسال طلب إضافة المنتج. يرجى مراجعة البيانات.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetchingOptions) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs text-slate-500 font-semibold">
          جاري تحضير نموذج إنشاء المنتج والأقسام...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
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
              قم بملء تفاصيل المنتج، رفع الصور، وتحديد المتغيرات (SKUs) والأسعار.
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المنتج *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: هاتف ذكي برو ماكس 256 جيجابايت"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الوصف التفصيلي *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب وصفاً مفصلاً للمنتج ومميزاته ومواصفاته الفنية..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Categories Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  القسم / الفئة (Category) *
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.length === 0 ? (
                    <option value="">لا توجد أقسام مسجلة في النظام</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Locked Brand Field (IDOR Security) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>العلامة التجارية (Brand)</span>
                  <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-semibold">
                    <Lock className="w-3 h-3" />
                    مقفل ومرتبط بحسابك
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={lockedBrandName}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 cursor-not-allowed font-bold focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  يتم ربط علامتك التجارية المعتمدة تلقائياً لمنع التلاعب وتطبيق أمان IDOR.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Image Uploader & Presigned URLs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              صور المنتج (Product Images) *
            </h3>
            <span className="text-xs text-slate-500">
              {images.length} صورة مرفوعة
            </span>
          </div>

          {/* Dropzone & Picker */}
          <div
            onClick={() => !uploadingImages && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              uploadingImages
                ? 'border-blue-300 bg-blue-50/50 cursor-wait'
                : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
              disabled={uploadingImages}
            />

            {uploadingImages ? (
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-2" />
                <p className="text-xs font-bold text-blue-800">
                  {uploadProgress || 'جاري رفع الصور عبر الرابط الموقّع (Presigned URL)...'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  يتم رفع الملفات مباشرة إلى السحابة بأمان تام.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800 mb-1">
                  انقر هنا لاختيار صور المنتج أو سحبها وإفلاتها
                </p>
                <p className="text-[11px] text-slate-400">
                  صيغ الصور المدعومة: JPG، PNG، WEBP (الحد الأقصى: 5 ميجابايت لكل صورة)
                </p>
              </div>
            )}
          </div>

          {/* Uploaded Thumbnails Preview */}
          {images.length > 0 && (
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                معاينة الصور المرفوعة:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {images.map((imgUrl, index) => (
                  <div
                    key={index}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square shadow-sm"
                  >
                    <img
                      src={imgUrl}
                      alt={`صورة المنتج ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {index === 0 && (
                      <span className="absolute bottom-1 right-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                        الرئيسية
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 left-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-lg opacity-90 group-hover:opacity-100 transition-opacity shadow"
                      title="حذف الصورة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Dynamic Variant Generator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              مولد المتغيرات والأسعار (Variant & Stock Generator)
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
                    placeholder="مثال: PRO-MAX-BLK-256"
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
                    onChange={(e) =>
                      handleVariantChange(idx, 'price', Number(e.target.value))
                    }
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
                    onChange={(e) =>
                      handleVariantChange(idx, 'initialStock', Number(e.target.value))
                    }
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
            disabled={loading || uploadingImages}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري حفظ المنتج وإرساله...</span>
              </>
            ) : (
              <span>حفظ وإرسال المنتج للاعتماد</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateProductPage;
