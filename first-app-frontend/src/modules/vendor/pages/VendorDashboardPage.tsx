import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  TrendingUp,
  Clock,
  PackageCheck,
  Lock,
  Wallet,
  ArrowUpRight,
  Loader2,
  PlusCircle,
  Boxes,
  ShoppingBag,
  AlertTriangle,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type { SellingEntity, VendorDashboardData, VendorOrder } from '../../../types/vendor';

export const VendorDashboardPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();
  const [dashboardData, setDashboardData] = useState<VendorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      if (!entity?._id) return;
      try {
        setLoading(true);
        const data = await vendorApi.getDashboardMetrics(entity._id);
        setDashboardData(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'فشل في تحميل مؤشرات لوحة التحكم');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardMetrics();
  }, [entity]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs text-slate-500 font-semibold">جاري حساب المؤشرات المالية والتشغيلية...</p>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6 text-center shadow-sm">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-800">{error || 'لا توجد بيانات متاحة حالياً'}</p>
      </div>
    );
  }

  const { metrics, recentOrders } = dashboardData;

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">تم التوصيل</span>;
      case 'SHIPPED':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold">تم الشحن</span>;
      case 'PROCESSING':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">قيد التجهيز</span>;
      case 'CONFIRMED':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-[10px] font-bold">مؤكد</span>;
      case 'CANCELLED':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">ملغى</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">معلق</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">أهلاً بك، {entity?.tradeName} 👋</h1>
          <p className="text-xs text-slate-500 mt-1">
            ملخص سريع لأداء متجرك، الطلبات الواردة، ورصيد الضمان الاجتماعي (Escrow).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/vendor/products/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المبيعات</span>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900">
              {metrics.totalSales.toLocaleString()} <span className="text-xs text-slate-500 font-normal">ج.م</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">
              جميع الطلبات المعالجة
            </span>
          </div>
        </div>

        {/* Card 2: Pending Orders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">طلبات معلقة</span>
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900">{metrics.pendingOrdersCount}</div>
            <span className="text-[10px] text-amber-600 font-semibold mt-1 inline-block">
              تتطلب تجهيزاً أو شحناً
            </span>
          </div>
        </div>

        {/* Card 3: Active Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">المنتجات النشطة</span>
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900">{metrics.activeProductsCount}</div>
            <span className="text-[10px] text-blue-600 font-semibold mt-1 inline-block">
              معتمدة وفي الكتالوج العام
            </span>
          </div>
        </div>

        {/* Card 4: Escrow vs Available Payout */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الرصيد في الضمان / القابل للسحب</span>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-500" /> محتجز في Escrow:
              </span>
              <span className="font-bold text-slate-900">{metrics.escrowBalance.toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-500" /> قابل للسحب:
              </span>
              <span className="font-bold text-emerald-600">{metrics.availablePayoutBalance.toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/vendor/products/new"
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">إضافة منتج جديد</h4>
            <p className="text-[10px] text-slate-500">إدخال البيانات والصور والمتغيرات</p>
          </div>
        </Link>

        <Link
          to="/vendor/inventory"
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">تحديث كميات المخزون</h4>
            <p className="text-[10px] text-slate-500">إعادة تعبئة المخزون لكل SKU</p>
          </div>
        </Link>

        <Link
          to="/vendor/orders"
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">متابعة الطلبات والشحن</h4>
            <p className="text-[10px] text-slate-500">تحديث حالة الشحن وإدخال الملاحظات</p>
          </div>
        </Link>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">أحدث الطلبات الواردة</h3>
            <p className="text-xs text-slate-500">أحدث 5 طلبات تم إرسالها لكيانك التجاري</p>
          </div>

          <Link
            to="/vendor/orders"
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            <span>عرض كل الطلبات</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
            لا توجد طلبات واردة حتى الآن
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم الطلب Sub-Order</th>
                  <th className="p-3">عدد العناصر</th>
                  <th className="p-3">إجمالي القيمة</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">تاريخ الطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order: VendorOrder) => (
                  <tr key={order._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">#{order._id.substring(0, 8)}</td>
                    <td className="p-3 text-slate-600 font-semibold">{order.items?.length || 0} عنصر</td>
                    <td className="p-3 font-bold text-slate-900">{order.subtotal?.toLocaleString()} ج.م</td>
                    <td className="p-3">{getOrderStatusBadge(order.status)}</td>
                    <td className="p-3 text-slate-400">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-EG') : 'الآن'}
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

export default VendorDashboardPage;
