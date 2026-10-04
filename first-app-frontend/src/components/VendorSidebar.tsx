import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Package,
  PlusCircle,
  ShoppingBag,
  Ticket,
  LogOut,
  Boxes,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import type { SellingEntity } from '../types/vendor';

interface VendorSidebarProps {
  entity?: SellingEntity | null;
  onItemClick?: () => void;
}

export const VendorSidebar: React.FC<VendorSidebarProps> = ({
  entity,
  onItemClick,
}) => {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItems = [
    { to: '/vendor/dashboard', label: 'نظرة عامة والتقارير', icon: BarChart3, end: true },
    { to: '/vendor/products', label: 'قائمة منتجاتي', icon: Package, end: true },
    { to: '/vendor/products/new', label: 'إضافة منتج جديد', icon: PlusCircle, end: false },
    { to: '/vendor/inventory', label: 'إدارة المخزون', icon: Boxes, end: false },
    { to: '/vendor/orders', label: 'طلبات العملاء الواردة', icon: ShoppingBag, end: false },
    { to: '/vendor/coupons', label: 'إدارة الكوبونات', icon: Ticket, end: false },
    { to: '/vendor/payouts', label: 'المحفظة والمستحقات', icon: Wallet, end: false },
  ];

  return (
    <div className="flex flex-col justify-between h-full space-y-6" dir="rtl">
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
                onClick={onItemClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-500'
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

      <div className="space-y-3 pt-4 border-t border-slate-100">
        {entity && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-right">
            <div className="text-[11px] font-bold text-slate-900 truncate">
              {entity.tradeName || entity.legalName}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              نوع الكيان: {entity.type === 'COMPANY' ? 'شركة' : 'تاجر مستقل'}
            </div>
          </div>
        )}

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

export default VendorSidebar;
