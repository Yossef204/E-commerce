import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  ShoppingBag,
  Truck,
  ShieldCheck,
  CreditCard,
  MapPin,
  Clock,
  Loader2,
} from 'lucide-react';
import apiClient from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';

export const OrderSuccessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const [order, setOrder] = useState<any>(location.state?.order || null);
  const [loading, setLoading] = useState<boolean>(!location.state?.order);

  useEffect(() => {
    if (order || !id || !user?.id) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/orders/my-orders/${user.id}`);
        const ordersList = res.data?.data || res.data || [];
        const found = ordersList.find(
          (o: any) => o._id === id || o.id === id || o.orderNumber === id,
        );
        if (found) {
          setOrder(found);
        }
      } catch (err) {
        console.error('Failed to fetch order details', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, user?.id, order]);

  const resolvedOrder =
    order?.mainOrder || order?.masterOrder || order?.order || order || {};
  const orderNumber =
    resolvedOrder.orderNumber || resolvedOrder._id || id || 'ORD-COMPLETED';
  const totalAmount =
    resolvedOrder.totalAmount ?? order?.totalAmount ?? 0;
  const paymentMethod =
    resolvedOrder.paymentMethod || order?.paymentMethod || 'COD';
  const shippingAddress =
    resolvedOrder.shippingAddress || order?.shippingAddress || '';

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-sm font-bold text-slate-600">جاري تحميل تفاصيل الطلب المؤكد...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        {/* Top Header Card */}
        <div className="bg-gradient-to-b from-emerald-50/80 via-emerald-50/30 to-white p-8 sm:p-12 text-center border-b border-slate-100 space-y-4">
          <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-in zoom-in-75 duration-300">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              تم التحقق وتأكيد الطلب بنجاح
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              شكراً لطلبك من منصتنا!
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
              تم حجز المنتجات وتأكيد طلبك بنجاح. نقوم الآن بإشعار المتاجر المستقلة لبدء التجهيز والشحن.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-mono text-xs font-bold shadow-md shadow-slate-900/20">
            <span>رقم الطلب:</span>
            <span className="text-blue-400 font-black tracking-wider">#{orderNumber}</span>
          </div>
        </div>

        {/* Order Details Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment & Status */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>طريقة الدفع والحالة</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold text-slate-900">
                    {paymentMethod === 'COD'
                      ? 'الدفع عند الاستلام (COD)'
                      : paymentMethod === 'CARD'
                      ? 'بطاقة بنكية'
                      : paymentMethod === 'WALLET'
                      ? 'محفظة إلكترونية'
                      : paymentMethod === 'INSTAPAY'
                      ? 'إنستاباي - InstaPay'
                      : paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>حالة التأكيد:</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    مؤكد وتم التحقق
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>إجمالي المبلغ المطلوب:</span>
                  <span className="font-black text-blue-600 text-sm">
                    {Number(totalAmount).toFixed(2)} ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* Shipping & Delivery */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>بيانات الشحن والتسليم</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-1.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">
                    {shippingAddress || 'العنوان المسجل في حسابك'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>مدة الشحن المتوقعة: 2 - 4 أيام عمل</span>
                </div>
              </div>
            </div>
          </div>

          {/* Escrow Guarantee Notice */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-900">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <span className="font-extrabold block text-emerald-950">
                تسوقك محمي بنظام الضمان المالي Escrow
              </span>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                لا يتم تحويل أرباح المنتجات إلى التجار إلا بعد استلامك للشحنة والتأكد من مطابقتها للمواصفات بنجاح.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              to="/my-orders"
              className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
            >
              <Package className="w-4 h-4" />
              <span>متابعة حالة طلباتي</span>
            </Link>

            <Link
              to="/"
              className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all border border-slate-200"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>العودة للتسوق</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessPage;

