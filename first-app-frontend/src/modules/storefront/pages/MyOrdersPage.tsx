import React from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';

interface OrderItem {
  sku: string;
  quantity: number;
  price?: number;
  title?: string;
}

interface CustomerOrder {
  _id: string;
  totalPrice?: number;
  status?: string;
  createdAt: string;
  shippingAddress?: string;
  items?: OrderItem[];
}

export const MyOrdersPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  const { data: orders = [], isLoading, isError } = useQuery<CustomerOrder[]>({
    queryKey: ['my-orders', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/orders/my-orders/${user?.id}`);
        return Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
      } catch {
        return [];
      }
    },
  });

  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم التوصيل
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
            <Truck className="w-3.5 h-3.5" />
            تم الشحن
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200">
            <Clock className="w-3.5 h-3.5" />
            جارٍ التجهيز
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            ملغي
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            قيد الانتظار
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2.5">
          <Package className="w-7 h-7 text-blue-600" />
          طلباتي السابقة
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          تابع حالة شحناتك وتفاصيل طلبات الشراء
        </p>
      </div>

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-bold">جارٍ تحميل قائمة الطلبات...</span>
        </div>
      ) : isError ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span className="text-xs font-bold">تعذر تحميل الطلبات، يرجى المحاولة لاحقاً</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-lg">لم تقم بإجراء أي طلبات بعد</h3>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              ابدأ التسوق الآن وتصفح آلاف المنتجات المميزة مع الشحن السريع!
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors shadow-md shadow-blue-500/20"
          >
            <span>تصفح المتجر</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order._id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-mono font-bold text-slate-700">
                    رقم الطلب: #{order._id.slice(-8).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-EG') : 'حديثاً'}
                    </span>
                  </div>
                </div>

                <div>{getStatusBadge(order.status)}</div>
              </div>

              {order.shippingAddress && (
                <div className="text-xs text-slate-500">
                  <span className="font-bold text-slate-700">عنوان التوصيل: </span>
                  {order.shippingAddress}
                </div>
              )}

              {order.items && order.items.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-3 divide-y divide-slate-100 text-xs">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center text-slate-700">
                      <span>
                        {item.title || `منتج (${item.sku})`} × {item.quantity}
                      </span>
                      {item.price ? (
                        <span className="font-bold font-mono">
                          {(item.price * item.quantity).toFixed(2)} ج.م
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {order.totalPrice ? (
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 text-sm">
                  <span className="font-bold text-slate-600">الإجمالي الكلي:</span>
                  <span className="font-black text-slate-900 text-base">
                    {order.totalPrice.toFixed(2)} <span className="text-xs text-slate-500">ج.م</span>
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
