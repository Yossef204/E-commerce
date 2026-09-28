import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  Lock,
  Store,
  Loader2,
  ShoppingBag,
  Clock,
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type { PlatformKPIs } from '../../../types/admin';

export const AdminDashboardPage: React.FC = () => {
  const { data: kpis, isLoading, isError } = useQuery<PlatformKPIs>({
    queryKey: ['platformKPIs'],
    queryFn: () => adminApi.getPlatformKPIs(),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-bold text-slate-500">جاري تحميل المؤشرات المالية والإدارية للمنصة...</p>
      </div>
    );
  }

  const kpiData = kpis || {
    gmv: 0,
    platformRevenue: 0,
    activeEscrowBalance: 0,
    activeStoresCount: 0,
    completedOrdersCount: 0,
    recentOrders: [],
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            مكتمل / مدفوع
          </span>
        );
      case 'PENDING_PAYMENT':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            في انتظار الدفع
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 rounded-full border border-rose-200">
            ملغي
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            مؤشرات الأداء والتحليلات المركزية (Platform KPIs)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            مراقبة شاملة لإجمالي المعاملات، عمولات المنصة، أرصدة الـ Escrow المعلقة وحركة الطلبات الكلية.
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>تحديث فوري مباشر</span>
        </div>
      </div>

      {isError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-4 rounded-xl font-medium">
          ملاحظة: تعذر الاتصال ببعض مؤشرات الباك إند، يتم عرض البيانات المتاحة حالياً.
        </div>
      )}

      {/* Platform KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* GMV */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">إجمالي حجم المعاملات (GMV)</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              ${kpiData.gmv.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">إجمالي المبيعات بالقيمة الاسمية</span>
          </div>
        </div>

        {/* Platform Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">إيرادات المنصة المحققة</div>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">
              ${kpiData.platformRevenue.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">العمولات المستقتطعة من العمليات</span>
          </div>
        </div>

        {/* Active Escrow Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">رصيد الضمان المعلق (Escrow)</div>
            <div className="text-2xl font-black text-amber-600 mt-0.5">
              ${kpiData.activeEscrowBalance.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">أرصدة محتجزة لحين التسليم</span>
          </div>
        </div>

        {/* Active Stores & Completed Orders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">المتاجر والطلبات المكتملة</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{kpiData.activeStoresCount} متجر</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-600">{kpiData.completedOrdersCount} طلب</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">الكيانات النشطة والعمليات الناجحة</span>
          </div>
        </div>
      </div>

      {/* Recent Platform Operations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-slate-700" />
            <h2 className="font-bold text-slate-900 text-base">أحدث العمليات والطلبات عبر المنصة</h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            إجمالي السجلات: {kpiData.recentOrders.length}
          </span>
        </div>

        {kpiData.recentOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            لا توجد طلبات أو عمليات مسجلة عبر المنصة حالياً.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">رقم الطلب الرئيسي</th>
                  <th className="py-3.5 px-4">معرف العميل (Customer ID)</th>
                  <th className="py-3.5 px-4">الإجمالي</th>
                  <th className="py-3.5 px-4">حالة الطلب</th>
                  <th className="py-3.5 px-4">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {kpiData.recentOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{order._id.substring(0, 10)}...
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {order.customerId.substring(0, 12)}...
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ${order.totalAmount} {order.currency || 'USD'}
                    </td>
                    <td className="py-3.5 px-4">{getOrderStatusBadge(order.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString('ar-EG')
                        : 'غير محدد'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
