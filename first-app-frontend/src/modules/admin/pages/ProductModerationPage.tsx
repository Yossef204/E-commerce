import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PackageCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  X,
  Boxes,
  ShieldAlert,
  Loader2,
  Layers,
  Store,
  Tag,
  AlertCircle,
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type { ProductModerationItem, ProductApprovalStatus } from '../../../types/admin';

export const ProductModerationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('PENDING_APPROVAL');
  const [selectedProduct, setSelectedProduct] = useState<ProductModerationItem | null>(null);

  // Loading state for specific product action
  const [processingProductId, setProcessingProductId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null);

  // Rejection modal
  const [rejectingProductId, setRejectingProductId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Toast notifications
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    data: products = [],
    isLoading,
    isRefetching,
  } = useQuery<ProductModerationItem[]>({
    queryKey: ['productsModeration', filterStatus],
    queryFn: async () => {
      const data = await adminApi.getProductsForModeration(
        filterStatus === 'ALL' ? undefined : filterStatus
      );
      // Safely unwrap data in all structures
      const unwrapped = Array.isArray(data) ? data : [];
      return unwrapped;
    },
  });

  const handleApprove = async (product: ProductModerationItem) => {
    try {
      setProcessingProductId(product._id);
      setProcessingAction('approve');
      await adminApi.approveProduct(product._id);

      setNotification({
        type: 'success',
        message: `تم اعتماد المنتج "${product.title}" بنجاح وأصبح متاحاً في المتجر.`,
      });

      queryClient.invalidateQueries({ queryKey: ['productsModeration'] });
      if (selectedProduct?._id === product._id) {
        setSelectedProduct(null);
      }
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error('Approve product error:', err);
      setNotification({
        type: 'error',
        message:
          err.response?.data?.message || 'فشل اعتماد المنتج. يرجى إعادة المحاولة.',
      });
    } finally {
      setProcessingProductId(null);
      setProcessingAction(null);
    }
  };

  const handleRejectPrompt = (id: string) => {
    setRejectingProductId(id);
    setRejectionReason('');
  };

  const submitRejection = async () => {
    if (!rejectingProductId) return;
    try {
      setProcessingProductId(rejectingProductId);
      setProcessingAction('reject');

      const reason =
        rejectionReason.trim() ||
        'الصور غير واضحة أو وصف المنتج غير مطابق لمعايير الجودة';

      await adminApi.rejectProduct(rejectingProductId, reason);

      setNotification({
        type: 'success',
        message: 'تم تسجيل رفض المنتج وإبلاغ التاجر بسبب الرفض.',
      });

      queryClient.invalidateQueries({ queryKey: ['productsModeration'] });
      if (selectedProduct?._id === rejectingProductId) {
        setSelectedProduct(null);
      }
      setRejectingProductId(null);
      setRejectionReason('');
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error('Reject product error:', err);
      setNotification({
        type: 'error',
        message:
          err.response?.data?.message || 'فشل رفض المنتج. يرجى إعادة المحاولة.',
      });
    } finally {
      setProcessingProductId(null);
      setProcessingAction(null);
    }
  };

  const getApprovalStatusBadge = (status: ProductApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> معتمد ومستوفى
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> ينتظر الاعتماد
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> مرفوض
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-amber-400" />
            مراجعة واعتمد المنتجات والكتالوج (Product Moderation)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            الفحص والمصادقة على المنتجات المرفوعة من التجار قبل إتاحتها للعملاء في المتجر.
          </p>
        </div>

        {isRefetching && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>جاري تحديث البيانات...</span>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-md transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'PENDING_APPROVAL', label: 'تنتظر الاعتماد (Pending)' },
          { id: 'APPROVED', label: 'المنتجات المعتمدة' },
          { id: 'REJECTED', label: 'المنتجات المرفوضة' },
          { id: 'ALL', label: 'كافة المنتجات' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterStatus === tab.id
                ? 'bg-slate-900 text-amber-400 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
          <p className="text-xs font-bold text-slate-500">
            جاري جلب المنتجات المرفوعة لمراجعة الكتالوج...
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400 text-xs font-medium">
          لا توجد منتجات مطابقة لهذا الفلتر حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const firstVariant = product.variants?.[0];
            const displayPrice = product.price ?? firstVariant?.price ?? 0;
            const displayStock = product.stock ?? firstVariant?.initialStock ?? 0;
            const thumbUrl = product.images?.[0] || product.image;

            const isThisProductApproving =
              processingProductId === product._id && processingAction === 'approve';
            const isThisProductRejecting =
              processingProductId === product._id && processingAction === 'reject';
            const isProcessingThis = isThisProductApproving || isThisProductRejecting;

            return (
              <div
                key={product._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="p-5 space-y-4">
                  {/* Thumbnail & Status Badge */}
                  <div className="h-44 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center relative border border-slate-200/60 group">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Boxes className="w-10 h-10 mx-auto mb-1 opacity-50" />
                        <span className="text-[10px] font-bold">لا توجد صورة مرفوعة</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getApprovalStatusBadge(product.approvalStatus)}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1" title={product.title}>
                      {product.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {product.description || product.desc || 'لا يوجد وصف متاح للمنتج'}
                    </p>
                  </div>

                  {/* Complete Metadata: Entity, Brand, Category, Price & Stock */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-2">
                    {/* Store / Selling Entity */}
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold text-slate-500 flex items-center gap-1.5 text-[11px]">
                        <Store className="w-3.5 h-3.5 text-blue-600" />
                        المتجر / الكيان:
                      </span>
                      <span className="font-bold text-slate-900 truncate max-w-[150px]">
                        {product.sellingEntityName || product.tradeName || 'غير محدد'}
                      </span>
                    </div>

                    {/* Brand */}
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold text-slate-500 flex items-center gap-1.5 text-[11px]">
                        <Tag className="w-3.5 h-3.5 text-purple-600" />
                        العلامة التجارية:
                      </span>
                      <span className="font-bold text-slate-900 truncate max-w-[150px]">
                        {product.brandName || 'غير محدد'}
                      </span>
                    </div>

                    {/* Category */}
                    {product.categoryName && (
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold text-slate-500 flex items-center gap-1.5 text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-amber-600" />
                          القسم / الفئة:
                        </span>
                        <span className="font-bold text-slate-900 truncate max-w-[150px]">
                          {product.categoryName}
                        </span>
                      </div>
                    )}

                    {/* Price and Stock Metrics */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-slate-500">السعر: </span>
                        <span className="font-black text-emerald-700 text-xs">
                          {displayPrice} ج.م
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">المخزون: </span>
                        <span className="font-bold text-slate-900">
                          {displayStock} قطعة
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">المتغيرات: </span>
                        <span className="font-mono font-bold text-slate-700">
                          {product.variants?.length || 1}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Eye className="w-4 h-4 text-slate-500" />
                    <span>معاينة كاملة</span>
                  </button>

                  {product.approvalStatus !== 'APPROVED' && (
                    <button
                      onClick={() => handleApprove(product)}
                      disabled={isProcessingThis}
                      className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-1"
                      title="اعتماد المنتج ونشره"
                    >
                      {isThisProductApproving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري...</span>
                        </>
                      ) : (
                        <span>اعتماد</span>
                      )}
                    </button>
                  )}

                  {product.approvalStatus !== 'REJECTED' && (
                    <button
                      onClick={() => handleRejectPrompt(product._id)}
                      disabled={isProcessingThis}
                      className="py-2 px-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                      title="رفض المنتج"
                    >
                      <span>رفض</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Detail Preview Drawer / Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 text-right border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {selectedProduct.title}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 font-mono">
                    معرف: {selectedProduct._id}
                  </span>
                  {getApprovalStatusBadge(selectedProduct.approvalStatus)}
                </div>
              </div>
            </div>

            {/* Gallery if multiple images */}
            {selectedProduct.images && selectedProduct.images.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-2">صور المنتج المرفوعة:</h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {selectedProduct.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-50"
                    >
                      <img
                        src={img}
                        alt={`صورة ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entities & Brands info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">المتجر / الكيان:</span>
                <span className="font-bold text-slate-900">
                  {selectedProduct.sellingEntityName || selectedProduct.tradeName || 'غير محدد'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">العلامة التجارية:</span>
                <span className="font-bold text-slate-900">
                  {selectedProduct.brandName || 'غير محدد'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">القسم / الفئة:</span>
                <span className="font-bold text-slate-900">
                  {selectedProduct.categoryName || 'غير محدد'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">وصف المنتج:</h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {selectedProduct.description || selectedProduct.desc || 'لا يوجد وصف متاح.'}
              </p>
            </div>

            {/* Variants Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">قائمة المتغيرات والـ SKUs:</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">السعر</th>
                      <th className="py-2.5 px-3">المخزون الأولي</th>
                      <th className="py-2.5 px-3">الخصائص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProduct.variants?.map((v) => (
                      <tr key={v._id || v.sku}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{v.sku}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">{v.price} ج.م</td>
                        <td className="py-2.5 px-3 font-bold">{v.initialStock || 0} قطعة</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {v.attributes ? JSON.stringify(v.attributes) : 'افتراضي'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rejection Reason if any */}
            {selectedProduct.rejectionReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                <div className="font-bold">سبب الرفض المسجل مسبقاً:</div>
                <div className="mt-0.5">{selectedProduct.rejectionReason}</div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                إغلاق
              </button>

              {selectedProduct.approvalStatus !== 'APPROVED' && (
                <button
                  onClick={() => handleApprove(selectedProduct)}
                  disabled={processingProductId === selectedProduct._id}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  {processingProductId === selectedProduct._id && processingAction === 'approve' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الاعتماد...</span>
                    </>
                  ) : (
                    <span>اعتماد ونشر المنتج</span>
                  )}
                </button>
              )}

              {selectedProduct.approvalStatus !== 'REJECTED' && (
                <button
                  onClick={() => handleRejectPrompt(selectedProduct._id)}
                  disabled={processingProductId === selectedProduct._id}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20"
                >
                  رفض المنتج
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-right border border-slate-200 relative">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <ShieldAlert className="w-5 h-5" />
              <span>سبب رفض المنتج</span>
            </div>
            <p className="text-xs text-slate-500">
              ادخل سبب الرفض الموضح للتاجر لتعديل المنتج وإعادة رفعه للاعتماد:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="مثال: صور المنتج منخفضة الجودة أو الوصف يحتوي على معلومات غير واضحة..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingProductId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={submitRejection}
                disabled={processingProductId === rejectingProductId}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20 flex items-center gap-1.5"
              >
                {processingProductId === rejectingProductId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الرفض...</span>
                  </>
                ) : (
                  <span>تأكيد الرفض</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminCatalogPage = ProductModerationPage;
export default ProductModerationPage;

