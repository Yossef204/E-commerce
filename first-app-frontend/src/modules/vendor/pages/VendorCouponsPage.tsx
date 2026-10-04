import React, { useState } from 'react';
import {
  Ticket,
  Plus,
  Tag,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';

interface Coupon {
  _id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

export const VendorCouponsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minOrderValue, setMinOrderValue] = useState<number>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(100);
  const [usageLimit, setUsageLimit] = useState<number>(50);

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ['vendor-coupons', user?.sellingEntityId],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/coupons/vendor');
        return Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/coupons', {
        code: code.trim().toUpperCase(),
        scope: 'VENDOR',
        sellingEntityId: user?.sellingEntityId,
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrderValue),
        maxDiscountAmount: discountType === 'PERCENTAGE' ? Number(maxDiscountAmount) : undefined,
        usageLimit: Number(usageLimit),
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-coupons'] });
      setShowModal(false);
      setCode('');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'فشل إنشاء الكوبون');
    },
  });

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('يرجى إدخال كود الكوبون');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">إدارة الكوبونات والخصومات</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              أنشئ كوبونات ترويجية لعملائك لزيادة مبيعات متجرك
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء كوبون جديد</span>
        </button>
      </div>

      {/* Coupons List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-xs font-bold">جارٍ تحميل الكوبونات...</span>
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Tag className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-base">لا توجد كوبونات حالياً</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              لم تقم بإنشاء أي كوبونات خصم بعد. ابدأ بإنشاء أول كوبون ترويجي لمتجرك!
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            إنشاء كوبون الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {coupons.map((c) => (
            <div
              key={c._id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4 hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-mono font-black text-sm tracking-wider border border-indigo-100">
                  <Ticket className="w-4 h-4" />
                  <span>{c.code}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.isActive ? 'نشط' : 'معطل'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between items-center">
                  <span>قيمة الخصم:</span>
                  <span className="font-black text-slate-900">
                    {c.discountType === 'PERCENTAGE'
                      ? `${c.discountValue}%`
                      : `${c.discountValue} ج.م`}
                  </span>
                </div>
                {c.minOrderValue ? (
                  <div className="flex justify-between items-center">
                    <span>الحد الأدنى للطلب:</span>
                    <span className="font-semibold text-slate-800">{c.minOrderValue} ج.م</span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center">
                  <span>مرات الاستخدام:</span>
                  <span className="font-semibold text-slate-800">
                    {c.usedCount || 0} / {c.usageLimit || 'غير محدود'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  صالح للاستخدام
                </span>
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  مفعل
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Coupon Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 animate-fade-in text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-600" />
                إنشاء كوبون خصم جديد
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رمز الكوبون (Coupon Code) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: SUMMER2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نوع الخصم
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PERCENTAGE">نسبة مئوية (%)</option>
                    <option value="FIXED_AMOUNT">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    قيمة الخصم *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الحد الأدنى لقيمة الطلب
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    أقصى قيمة للخصم
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  أقصى عدد مرات استخدام
                </label>
                <input
                  type="number"
                  min={1}
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جارٍ الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ الكوبون</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorCouponsPage;
