import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type { ProductModerationItem, ProductApprovalStatus } from '../../../types/admin';

export const ProductModerationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('PENDING_APPROVAL');
  const [selectedProduct, setSelectedProduct] = useState<ProductModerationItem | null>(null);

  // Rejection modal
  const [rejectingProductId, setRejectingProductId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const { data: products = [], isLoading } = useQuery<ProductModerationItem[]>({
    queryKey: ['productsModeration', filterStatus],
    queryFn: () => adminApi.getProductsForModeration(filterStatus === 'ALL' ? undefined : filterStatus),
  });

  const updateApprovalMutation = useMutation({
    mutationFn: ({ id, approvalStatus, rejectionReason }: { id: string; approvalStatus: ProductApprovalStatus; rejectionReason?: string }) =>
      adminApi.updateProductApproval(id, approvalStatus, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productsModeration'] });
      setSelectedProduct(null);
      setRejectingProductId(null);
      setRejectionReason('');
    },
  });

  const handleApprove = (id: string) => {
    updateApprovalMutation.mutate({ id, approvalStatus: 'APPROVED' });
  };

  const handleRejectPrompt = (id: string) => {
    setRejectingProductId(id);
  };

  const submitRejection = () => {
    if (rejectingProductId) {
      updateApprovalMutation.mutate({
        id: rejectingProductId,
        approvalStatus: 'REJECTED',
        rejectionReason: rejectionReason.trim() || 'الصور غير واضحة أو وصف المنتج غير مطابق للمعايير',
      });
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-bold text-slate-500">جاري جلب المنتجات المرفوعة لمراجعة الكتالوج...</p>
      </div>
    );
  }

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
            الفحص الدقيق للمنتجات المضافة حديثاً قبل ظهورها في المتجر للعملاء.
          </p>
        </div>
      </div>

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

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400 text-xs font-medium">
          لا توجد منتجات في هذه الحالة حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product._id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div className="p-5 space-y-4">
                <div className="h-40 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center relative border border-slate-200/60">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Boxes className="w-10 h-10 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px] font-bold">لا توجد صورة للمنتج</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getApprovalStatusBadge(product.approvalStatus)}
                  </div>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1">
                    {product.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {product.description || 'لا يوجد وصف متاح للمنتج'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold">عدد المتغيرات (SKUs):</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                      {product.variants?.length || 0}
                    </span>
                  </div>
                  {product.variants && product.variants.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      السعر الأولي: <span className="font-bold text-slate-900">${product.variants[0].price}</span> | المخزون: <span className="font-bold text-slate-900">{product.variants[0].initialStock || 0}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => setSelectedProduct(product)}
                  className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span>معاينة</span>
                </button>

                {product.approvalStatus !== 'APPROVED' && (
                  <button
                    onClick={() => handleApprove(product._id)}
                    disabled={updateApprovalMutation.isPending}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                  >
                    موافقة
                  </button>
                )}

                {product.approvalStatus !== 'REJECTED' && (
                  <button
                    onClick={() => handleRejectPrompt(product._id)}
                    disabled={updateApprovalMutation.isPending}
                    className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                  >
                    رفض
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Detail Preview Drawer / Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 text-right border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

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
                    ID: {selectedProduct._id}
                  </span>
                  {getApprovalStatusBadge(selectedProduct.approvalStatus)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">وصف المنتج:</h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {selectedProduct.description || 'لا يوجد وصف متاح.'}
              </p>
            </div>

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
                        <td className="py-2.5 px-3 font-bold text-emerald-600">${v.price}</td>
                        <td className="py-2.5 px-3 font-bold">{v.initialStock || 0} قطعة</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {v.attributes ? JSON.stringify(v.attributes) : 'لا يوجد'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedProduct.rejectionReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                <div className="font-bold">سبب الرفض المسجل:</div>
                <div>{selectedProduct.rejectionReason}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => handleApprove(selectedProduct._id)}
                disabled={updateApprovalMutation.isPending}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-emerald-600/20"
              >
                اعتماد ونشر المنتج
              </button>

              <button
                onClick={() => handleRejectPrompt(selectedProduct._id)}
                disabled={updateApprovalMutation.isPending}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20"
              >
                رفض المنتج
              </button>
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
              ادخل سبب الرفض الموضح للتاجر لتعديل المنتج وإعادة رفعه:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="مثال: صور المنتج منخفضة الجودة أو الوصف يحتوي على معلومات مضللة..."
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
                disabled={updateApprovalMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductModerationPage;
