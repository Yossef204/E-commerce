import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  PackageCheck,
  Landmark,
  ShieldCheck,
  Shield,
  LogOut,
  ArrowRight,
  Menu,
  X,
  Store,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { NotificationBell } from '../components/NotificationBell';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin', label: 'نظرة عامة والتحليلات', icon: LayoutDashboard, end: true },
    { to: '/admin/entities', label: 'اعتماد الكيانات والمتاجر', icon: Building2, end: false },
    { to: '/admin/products', label: 'مراجعة الكتالوج والمنتجات', icon: PackageCheck, end: false },
    { to: '/admin/finance', label: 'التسويات المالية والـ Escrow', icon: Landmark, end: false },
    { to: '/admin/audit-logs', label: 'سجل التدقيق والأمان', icon: ShieldCheck, end: false },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 font-sans" dir="rtl">
      {/* Top Super Admin Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Right Side: Logo & Admin Badge */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg"
              >
                {isMobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <Link to="/admin" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/30">
                  <Shield className="w-6 h-6 font-bold" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-base text-white tracking-tight flex items-center gap-2">
                    لوحة الإدارة العليا
                  </span>
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">
                    Super Admin Control Plane
                  </span>
                </div>
              </Link>
            </div>

            {/* Left Side: Notifications, Nav Link, Profile & Logout */}
            <div className="flex items-center gap-3">
              <NotificationBell />

              <div className="h-6 w-px bg-slate-800" />

              <Link
                to="/vendor"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                title="بوابة البائع"
              >
                <Store className="w-3.5 h-3.5" />
                <span>بوابة التاجر</span>
              </Link>

              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
              >
                <span>المتجر</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>

              <div className="h-6 w-px bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-white">{user?.userName}</span>
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase font-mono">
                    {user?.role}
                  </span>
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

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex gap-6 relative">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-40 w-64 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-transform duration-300 transform ${
            isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-6">
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-3">
              إدارة المنصة والكتالوج
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs transition-all ${
                        isActive
                          ? 'bg-slate-900 text-amber-400 shadow-md shadow-slate-900/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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

          {/* Admin System Card */}
          <div className="bg-slate-900 text-slate-300 rounded-xl p-3.5 border border-slate-800 mt-6 text-xs">
            <div className="flex items-center gap-2 font-bold text-white mb-1">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>بيئة التحكم المركزية</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              تتم صيانة وتتبع كافة إجراءات المشرفين وحركات الـ Escrow بشكل دائم عبر سجل التدقيق.
            </p>
          </div>
        </aside>

        {/* Overlay for mobile drawer */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
          />
        )}

        {/* Main View Area */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
