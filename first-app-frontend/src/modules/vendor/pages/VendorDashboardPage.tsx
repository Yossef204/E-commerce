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
  AlertTriangle,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type {
  SellingEntity,
  VendorDashboardData,
  VendorOrder,
  CompanyDashboardOverviewData,
} from '../../../types/vendor';

export const VendorDashboardPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [overview, setOverview] = useState<CompanyDashboardOverviewData | null>(null);
  const [dashboardData, setDashboardData] = useState<VendorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!entity?._id) return;
      try {
        setLoading(true);
        const [overviewRes, metricsRes] = await Promise.allSettled([
          vendorApi.getCompanyDashboardOverview(entity._id, period),
          vendorApi.getDashboardMetrics(entity._id),
        ]);

        if (overviewRes.status === 'fulfilled' && overviewRes.value) {
          setOverview(overviewRes.value);
        }
        if (metricsRes.status === 'fulfilled' && metricsRes.value) {
          setDashboardData(metricsRes.value);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'فشل في تحميل مؤشرات لوحة التحكم');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [entity, period]);

  if (loading && !overview && !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs text-slate-500 font-semibold">جاري حساب المؤشرات المالية والتشغيلية...</p>
      </div>
    );
  }

  const sales = overview?.salesSummary || {
    totalSales: dashboardData?.metrics?.totalSales || 0,
    ordersCount: dashboardData?.recentOrders?.length || 0,
    avgOrderValue: 0,
    currency: 'ج.م',
  };

  const actionOrders = overview?.ordersRequiringAction || {
    pending: dashboardData?.metrics?.pendingOrdersCount || 0,
    confirmed: 0,
    processing: 0,
    total: dashboardData?.metrics?.pendingOrdersCount || 0,
  };

  const balances = overview?.financialBalances || {
    heldEscrowBalance: dashboardData?.metrics?.escrowBalance || 0,
    availablePayoutBalance: dashboardData?.metrics?.availablePayoutBalance || 0,
    codDebt: 0,
    currency: 'ج.م',
  };

  const lowStock = overview?.lowStockAlerts || {
    count: 0,
    items: [],
    hasAlert: false,
  };

  const pendingApprovals = overview?.pendingApprovals || {
    pendingProductsCount: 0,
    requiresAction: false,
  };

  const recentOrders = dashboardData?.recentOrders || [];

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
    <div className="space-y-6" dir="rtl">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">أهلاً بك، {entity?.tradeName} 👋</h1>
          <p className="text-xs text-slate-500 mt-1">
            ملخص سريع لأداء متجرك، رصيد السحب المتاح، المبيعات والطلبات الواردة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
            <button
              onClick={() => setPeriod('day')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'day' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'month' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'year' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'hover:text-slate-900'
              }`}
            >
              هذا العام
            </button>
          </div>

          <Link
            to="/vendor/products/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة منتج</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-4 rounded-xl font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Sales Summary & Financial Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales in Period */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              إجمالي المبيعات ({period === 'day' ? 'اليوم' : period === 'year' ? 'العام' : 'الشهر'})
            </span>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900">
              {sales.totalSales.toLocaleString()} <span className="text-xs text-slate-500 font-normal">ج.م</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 font-medium">
              <span>{sales.ordersCount} طلب مكتمل</span>
              {sales.avgOrderValue > 0 && (
                <span>متوسط: {sales.avgOrderValue} ج.م</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Orders Requiring Action */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">طلبات تتطلب إجراء</span>
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-amber-600">{actionOrders.total}</div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-600 font-semibold">
              <span className="bg-slate-100 px-1.5 py-0.5 rounded">معلق: {actionOrders.pending}</span>
              <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">مؤكد: {actionOrders.confirmed}</span>
              <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">تجهيز: {actionOrders.processing}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Financial Balances - Available for Payout */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الرصيد المتاح للسحب</span>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-emerald-600">
              {balances.availablePayoutBalance.toLocaleString()} <span className="text-xs text-slate-500 font-normal">ج.م</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-medium mt-1 inline-block">
              بعد خصم المرتجعات والمسحوبات
            </span>
          </div>
        </div>

        {/* Card 4: Financial Balances - Held Escrow & COD */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">الضمان المعلق ومديونية COD</span>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-500" /> محتجز في الضمان:
              </span>
              <span className="font-bold text-slate-900">{balances.heldEscrowBalance.toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-500" /> مديونية COD:
              </span>
              <span className={`font-bold ${balances.codDebt > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {balances.codDebt.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Row: Pending Approvals & Low Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Product Approvals */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">تعديلات ومنتجات بانتظار الاعتماد</div>
              <div className="text-[11px] text-slate-500">يتم مراجعة المنتجات من قبل مسؤولي المنصة</div>
            </div>
          </div>
          <div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              pendingApprovals.pendingProductsCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              {pendingApprovals.pendingProductsCount} قيد المراجعة
            </span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${lowStock.hasAlert ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">تنبيهات انخفاض المخزون (≤ 5 وحدات)</div>
              <div className="text-[11px] text-slate-500">
                {lowStock.hasAlert
                  ? `يوجد ${lowStock.count} منتج / متغير وصل لمستوى المخزون الحرج`
                  : 'مستويات المخزون كافية لجميع المنتجات'}
              </div>
            </div>
          </div>
          <div>
            <Link
              to="/vendor/inventory"
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                lowStock.hasAlert
                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {lowStock.hasAlert ? 'تحديث المخزون' : 'مستقر'}
            </Link>
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
            <h4 className="text-xs font-bold text-slate-900">إدارة المخزون</h4>
            <p className="text-[10px] text-slate-500">تعديل وإعادة تعبئة كميات الـ SKU</p>
          </div>
        </Link>

        <Link
          to="/vendor/wallet"
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">محفظة التاجر والتسويات</h4>
            <p className="text-[10px] text-slate-500">طلب السحب ومتابعة سجل الحركات</p>
          </div>
        </Link>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">أحدث الطلبات الواردة</h3>
            <p className="text-xs text-slate-500">أحدث الطلبات المسجلة لكيانك التجاري</p>
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
