import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Boxes,
  ShoppingBag,
  Wallet,
  Store,
  LogOut,
  ArrowRight,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import vendorApi from '../api/vendorApi';
import type { SellingEntity } from '../types/vendor';

export const VendorLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [entity, setEntity] = useState<SellingEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchVendorEntity = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const entityData = await vendorApi.getProfile(user.id);
        setEntity(entityData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'لم يتم العثور على ملف تجاري مسجل لهذا الحساب');
      } finally {
        setLoading(false);
      }
    };

    fetchVendorEntity();
  }, [user]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItems = [
    { to: '/vendor', label: 'نظرة عامة', icon: LayoutDashboard, end: true },
    { to: '/vendor/products', label: 'منتجاتي', icon: Package, end: true },
    { to: '/vendor/products/new', label: 'إضافة منتج جديد', icon: PlusCircle, end: false },
    { to: '/vendor/inventory', label: 'إدارة المخزون', icon: Boxes, end: false },
    { to: '/vendor/orders', label: 'الطلبات الواردة', icon: ShoppingBag, end: false },
    { to: '/vendor/payouts', label: 'المحفظة والمستحقات', icon: Wallet, end: false },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-semibold text-slate-300">جاري تحميل بيانات بوابة التاجر...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 font-sans" dir="rtl">
      {/* Top Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Right Side: Logo & Entity Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg"
              >
                {isMobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <Link to="/vendor" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                  <Store className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-base text-white tracking-tight">بوابة التاجر</span>
                  <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider">
                    Vendor Hub
                  </span>
                </div>
              </Link>

              {entity && (
                <div className="hidden sm:flex items-center gap-2 pr-4 border-r border-slate-800">
                  <span className="text-xs font-bold text-slate-200">{entity.tradeName}</span>
                  {entity.status === 'APPROVED' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> مقتمد
                    </span>
                  )}
                  {entity.status === 'PENDING_APPROVAL' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <Clock className="w-3 h-3" /> قيد المراجعة
                    </span>
                  )}
                  {entity.status === 'REJECTED' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20">
                      <XCircle className="w-3 h-3" /> مرفوض
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Left Side: Actions */}
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
              >
                <span>متجر العملاء</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>

              <div className="h-6 w-px bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-white">{user?.userName}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">{user?.role}</span>
                </div>

                <button
                  onClick={handleLogout}
                  title="تسجيل الخروج"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex gap-6 relative">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-40 w-64 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-transform duration-300 transform ${
            isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-6">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3">
              قائمة التحكم
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Banner */}
          {entity && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-6">
              <div className="text-[11px] font-bold text-slate-900">{entity.tradeName}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                نوع الكيان: {entity.type === 'COMPANY' ? 'شركة' : 'تاجر مستقل'}
              </div>
            </div>
          )}
        </aside>

        {/* Overlay backdrop for mobile drawer */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
          />
        )}

        {/* Dynamic Content View */}
        <main className="flex-1 min-w-0">
          {error ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">تعذر الوصول إلى بوابة التاجر</h3>
              <p className="text-xs text-slate-500 mb-6">{error}</p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
              >
                تسجيل كيان تجاري جديد
              </Link>
            </div>
          ) : (
            <Outlet context={{ entity }} />
          )}
        </main>
      </div>
    </div>
  );
};

export default VendorLayout;
