import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Coins,
  TrendingUp,
  Store,
  Loader2,
  Clock,
  ShieldCheck,
  Building2,
  UserCheck,
  PackageCheck,
  AlertTriangle,
  RotateCcw,
  AlertCircle,
  Radio,
  Users,
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type { AdminDashboardOverviewData } from '../../../types/admin';

export const AdminDashboardPage: React.FC = () => {
  const { data: overview, isLoading, isError } = useQuery<AdminDashboardOverviewData>({
    queryKey: ['adminDashboardOverview'],
    queryFn: () => adminApi.getAdminDashboardOverview(),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-bold text-slate-500">جاري تجميع المؤشرات المالية والإدارية الشاملة للمنصة...</p>
      </div>
    );
  }

  const data = overview || {
    platformOverview: {
      totalOrders: 0,
      gmv: 0,
      totalUsers: 0,
      totalSellers: 0,
      activeStoresCount: 0,
      usersByRole: {},
      currency: 'EGP',
    },
    approvalsCenter: {
      pendingCompanyRegistrations: 0,
      pendingIndependentSellers: 0,
      productsPendingApproval: 0,
      totalPendingApprovals: 0,
      requiresAttention: false,
    },
    financialHealth: {
      totalCollectedCommissions: 0,
      totalHeldEscrow: 0,
      pendingPayoutRequestsVolume: 0,
      pendingPayoutRequestsCount: 0,
      currency: 'EGP',
    },
    issuesAndFailures: {
      failedFinancialTransactions: 0,
      unhandledWebhooks: 0,
      pendingReturns: 0,
      totalIssues: 0,
      hasCriticalIssues: false,
    },
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            لوحة الإدارة المركزية والرقابة المالية (Admin Command Center)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            مراقبة شاملة وموحدة للأداء العام، اعتمادات الكيانات والمنتجات، السلامة المالية، ورصد الأعطال والعمليات المعلقة.
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>تحديث تجميعي حي (Live Aggregation)</span>
        </div>
      </div>

      {isError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-4 rounded-xl font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>ملاحظة: تعذر الاتصال ببعض بيانات خطوط التجميع، يتم عرض البيانات الافتراضية حالياً.</span>
        </div>
      )}

      {/* 1. Platform Overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <Coins className="w-4 h-4 text-blue-600" />
            <span>نظرة عامة على المنصة (Platform Overview)</span>
          </h2>
          <span className="text-xs text-slate-400 font-semibold">إحصائيات كلية ومباشرة</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GMV */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">حجم التداول الكلي (GMV)</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {data.platformOverview.gmv.toLocaleString()} <span className="text-xs font-normal text-slate-500">ج.م</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">إجمالي المبيعات بالقيمة الاسمية</span>
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">إجمالي الطلبات المعالجة</div>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">
                {data.platformOverview.totalOrders.toLocaleString()} <span className="text-xs font-normal text-slate-500">طلب</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">كافة العمليات والطلبات بالمنصة</span>
            </div>
          </div>

          {/* Total Stores / Sellers */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
            <div className="p-3.5 bg-purple-50 text-purple-600 rounded-xl">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">التجار والكيانات المسجلة</div>
              <div className="text-xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
                <span>{data.platformOverview.totalSellers} مسجل</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-600 font-bold">{data.platformOverview.activeStoresCount} نشط</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">الشركات والبائعين المستقلين</span>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-all">
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-bold">إجمالي المستخدمين المسجلين</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {data.platformOverview.totalUsers.toLocaleString()} <span className="text-xs font-normal text-slate-500">مستخدم</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">العملاء، الموظفين والإداريين</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Approvals Center */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-extrabold text-slate-900">
              مركز الاعتمادات والرقابة (Approvals Center)
            </h2>
          </div>
          {data.approvalsCenter.totalPendingApprovals > 0 ? (
            <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">
              {data.approvalsCenter.totalPendingApprovals} طلب قيد المراجعة
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
              لا توجد طلبات معلقة
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700">تسجيل الشركات المعلق</div>
                <div className="text-[11px] text-slate-400">بانتظار اعتماد السجل والبطاقة الضريبية</div>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">
              {data.approvalsCenter.pendingCompanyRegistrations}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-lg">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700">البائعين المستقلين المعلقين</div>
                <div className="text-[11px] text-slate-400">بانتظار التحقق من الرقم القومي والبيانات</div>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">
              {data.approvalsCenter.pendingIndependentSellers}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700">المنتجات بانتظار الاعتماد</div>
                <div className="text-[11px] text-slate-400">منتجات وتعديلات جديدة تنتظر الفحص</div>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">
              {data.approvalsCenter.productsPendingApproval}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Financial Health & 4. Issues & Failures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Health */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Coins className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-extrabold text-slate-900">
              السلامة المالية والسيولة (Financial Health)
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <div>
                <div className="text-xs font-bold text-emerald-900">إجمالي العمولات المحصلة للمنصة</div>
                <div className="text-[10px] text-emerald-700">من قيود PLATFORM_FEE_DEBIT المستقطعة</div>
              </div>
              <div className="text-xl font-black text-emerald-700">
                {data.financialHealth.totalCollectedCommissions.toLocaleString()} ج.م
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-amber-50/60 rounded-xl border border-amber-100">
              <div>
                <div className="text-xs font-bold text-amber-900">إجمالي رصيد الضمان المعلق (Held Escrow)</div>
                <div className="text-[10px] text-amber-700">أرصدة المبيعات قيد الحجز لحين التأكيد والتسليم</div>
              </div>
              <div className="text-xl font-black text-amber-700">
                {data.financialHealth.totalHeldEscrow.toLocaleString()} ج.م
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-blue-50/60 rounded-xl border border-blue-100">
              <div>
                <div className="text-xs font-bold text-blue-900">حجم طلبات السحب المعلقة</div>
                <div className="text-[10px] text-blue-700">{data.financialHealth.pendingPayoutRequestsCount} طلب بانتظار التحويل البنكي</div>
              </div>
              <div className="text-xl font-black text-blue-700">
                {data.financialHealth.pendingPayoutRequestsVolume.toLocaleString()} ج.م
              </div>
            </div>
          </div>
        </div>

        {/* Issues & Failures */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <h2 className="text-sm font-extrabold text-slate-900">
                مركز الأعطال والعمليات المتعثرة (Issues & Failures)
              </h2>
            </div>
            {data.issuesAndFailures.hasCriticalIssues ? (
              <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">
                {data.issuesAndFailures.totalIssues} تنبيه نشط
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                كل النظم تعمل بكفاءة
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3.5 bg-rose-50/50 rounded-xl border border-rose-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">المعاملات المالية المتعثرة (Failed Payments)</div>
                  <div className="text-[10px] text-slate-400">عمليات دفع مرفوضة أو غير مكتملة</div>
                </div>
              </div>
              <div className="text-lg font-black text-rose-600">
                {data.issuesAndFailures.failedFinancialTransactions}
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">الـ Webhooks المعلقة أو غير المعالجة</div>
                  <div className="text-[10px] text-slate-400">عمليات معلقة منذ أكثر من ساعة بانتظار التأكيد</div>
                </div>
              </div>
              <div className="text-lg font-black text-amber-600">
                {data.issuesAndFailures.unhandledWebhooks}
              </div>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-purple-50/50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">طلبات المرتجعات المعلقة (Pending Returns)</div>
                  <div className="text-[10px] text-slate-400">بانتظار الفحص والمعاينة والموافقة على الاسترداد</div>
                </div>
              </div>
              <div className="text-lg font-black text-purple-600">
                {data.issuesAndFailures.pendingReturns}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
