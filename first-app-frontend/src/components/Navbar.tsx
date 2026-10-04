import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  ShoppingCart,
  LogOut,
  Shield,
  Menu,
  X,
  Package,
  ListOrdered,
  LayoutDashboard,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';

interface NavbarProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const cartCount = useCartStore((state) => state.getTotalItems());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const normalizedRole = (user?.role || '').toLowerCase();
  const isCustomer =
    !isAuthenticated ||
    normalizedRole === 'customer' ||
    normalizedRole === 'user';
  const isVendor =
    normalizedRole === 'seller' || normalizedRole === 'company_admin';
  const isAdmin =
    normalizedRole === 'admin' || normalizedRole === 'super_admin';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-slate-900">سوقنا</span>
              <span className="text-[10px] text-blue-600 font-extrabold tracking-widest -mt-1 uppercase">
                E-Commerce Store
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              الرئيسية
            </Link>
            <Link to="/products" className="hover:text-blue-600 transition-colors">
              تصفح المنتجات
            </Link>
            {isAuthenticated && isCustomer && (
              <Link
                to="/my-orders"
                className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
              >
                <ListOrdered className="w-4 h-4 text-blue-500" />
                <span>طلباتي</span>
              </Link>
            )}
          </nav>

          {/* Right Action Icons & Auth Profile */}
          <div className="flex items-center gap-3">
            {/* Interactive Cart Button (Always visible for shoppers) */}
            <Link
              to="/cart"
              aria-label="عربة التسوق"
              className="relative p-2.5 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors inline-flex items-center justify-center"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            {/* Authenticated User Status */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                {/* Specific Vendor Quick Action Button */}
                {isVendor && (
                  <div className="hidden sm:flex items-center gap-2">
                    <Link
                      to="/vendor/dashboard"
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-indigo-200 transition-colors shadow-sm"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>لوحة إدارة التاجر</span>
                    </Link>
                    <Link
                      to="/vendor/products"
                      className="px-3 py-2 text-slate-600 hover:text-indigo-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>منتجاتي</span>
                    </Link>
                  </div>
                )}

                {/* Specific Admin Quick Action Button */}
                {isAdmin && (
                  <Link
                    to="/admin/entities"
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl border border-amber-200 transition-colors shadow-sm"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>لوحة تحكم السوبر أدمن</span>
                  </Link>
                )}

                {/* User Identity Details */}
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {user.userName}
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block self-start mt-0.5">
                    {isVendor ? 'تاجر / بائع' : isAdmin ? 'مدير المنصة' : 'عميل'}
                  </span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  title="تسجيل الخروج"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              /* Non-registered Visitor State */
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-slate-700 hover:text-blue-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all"
                >
                  إنشاء حساب
                </Link>
              </div>
            )}

            {/* Mobile Drawer Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl"
              aria-label="القائمة الرئيسية"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white p-4 space-y-4 animate-fade-in">
          <nav className="flex flex-col space-y-2 text-sm font-bold text-slate-700">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-50"
            >
              الرئيسية
            </Link>
            <Link
              to="/products"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-50"
            >
              تصفح المنتجات
            </Link>

            {isAuthenticated && isCustomer && (
              <Link
                to="/my-orders"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between"
              >
                <span>طلباتي</span>
                <ListOrdered className="w-4 h-4 text-blue-600" />
              </Link>
            )}

            <Link
              to="/cart"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between"
            >
              <span>عربة التسوق</span>
              {cartCount > 0 && (
                <span className="bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </Link>

            {isAuthenticated && isVendor && (
              <>
                <div className="border-t border-slate-100 my-1 pt-1 text-[11px] text-slate-400">
                  إدارة المتجر
                </div>
                <Link
                  to="/vendor/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-indigo-700 bg-indigo-50 font-bold flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>لوحة إدارة التاجر</span>
                </Link>
                <Link
                  to="/vendor/products"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  <span>منتجاتي</span>
                </Link>
              </>
            )}

            {isAuthenticated && isAdmin && (
              <>
                <div className="border-t border-slate-100 my-1 pt-1 text-[11px] text-slate-400">
                  إدارة النظام
                </div>
                <Link
                  to="/admin/entities"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-amber-800 bg-amber-50 font-bold flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  <span>لوحة تحكم السوبر أدمن</span>
                </Link>
              </>
            )}

            {isAuthenticated ? (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="text-right px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center gap-2 mt-2 pt-2 border-t border-slate-100"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            ) : (
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-center px-4 py-2 text-slate-700 font-bold text-xs rounded-xl bg-slate-100"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-center px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
                >
                  إنشاء حساب
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
