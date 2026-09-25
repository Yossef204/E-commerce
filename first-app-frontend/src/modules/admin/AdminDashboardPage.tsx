import React from 'react';
import { Shield, Users, CheckCircle, AlertTriangle } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-yellow-400" />
            لوحة الإدارة العليا (Super Admin)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            إدارة المستخدمين، البائعين، الموافقة على المنتجات ومتابعة عمليات المنصة.
          </p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">إجمالي المستخدمين</div>
            <div className="text-2xl font-extrabold text-slate-800">1,240</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">منتجات تنتظر الاعتماد</div>
            <div className="text-2xl font-extrabold text-amber-600">8 منتجات</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">تجار موثقون</div>
            <div className="text-2xl font-extrabold text-slate-800">32 تجار</div>
          </div>
        </div>
      </div>
    </div>
  );
};
