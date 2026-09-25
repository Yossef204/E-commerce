import React from 'react';
import { Store, Package, DollarSign, TrendingUp, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export const VendorDashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Store className="w-7 h-7 text-blue-600" />
            لوحة تحكم البائع
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            مرحباً {user?.userName || 'بالتاجر'}، أهلاً بك في منصة إدارة المنتجات والمبيعات.
          </p>
        </div>

        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>إجمالي المبيعات</span>
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800">12,450 ج.م</div>
          <div className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            +15% مقارنة بالشهر الماضي
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>عدد الطلبات</span>
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800">48 طلب</div>
          <div className="text-xs text-blue-600 font-semibold">5 طلبات قيد التنفيذ</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>المنتجات النشطة</span>
            <Store className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800">14 منتج</div>
          <div className="text-xs text-slate-500">2 منتجات بانتظار الموافقة</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>الرصيد المعلق (Escrow)</span>
            <DollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600">3,200 ج.م</div>
          <div className="text-xs text-slate-500">سيتم الإفراج فور الاستلام</div>
        </div>
      </div>
    </div>
  );
};

