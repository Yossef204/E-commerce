import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Building2,
  PackageCheck,
  Users,
  Landmark,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface AdminSidebarProps {
  onItemClick?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onItemClick }) => {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin', label: 'نظرة عامة والتحليلات', icon: LayoutDashboard, end: true },
    { to: '/admin/entities', label: 'مراجعة واعتماد الكيانات التجارية', icon: Building2, end: false },
    { to: '/admin/products', label: 'مراجعة واعتماد المنتجات', icon: PackageCheck, end: false },
    { to: '/admin/permissions', label: 'إدارة الصلاحيات', icon: Users, end: false },
    { to: '/admin/financials', label: 'التقارير المالية وحسابات الضمان', icon: Landmark, end: false },
    { to: '/admin/audit-logs', label: 'سجل التدقيق والأمان', icon: ShieldCheck, end: false },
  ];

  return (
    <div className="flex flex-col justify-between h-full space-y-6" dir="rtl">
      <div className="space-y-6">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3">
          لوحة تحكم الإدارة العليا
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onItemClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-1 ring-amber-400 font-black'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
