import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  ShoppingCart,
  LogOut,
  Store,
  Shield,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const StorefrontLayout: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const cartCount = 0; // Placeholder for cart count state

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Future search query handling
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans" dir="rtl">
      {/* Top Announcement Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 text-center border-b border-slate-800">
        شحن مجاني لكافة الطلبات الأكثر من 500 ج.م | خيارات دفع متعددة آمنة 100%
      </div>

      {/* Main Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
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

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتجات، ماركات، فئات..."
                className="w-full pr-11 pl-24 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
              />
              <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3" />
              <button
                type="submit"
                className="absolute left-1.5 top-1.5 bottom-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                بحث
              </button>
            </form>

            {/* Right Nav Options */}
            <div className="flex items-center gap-3">
              {/* Cart Button */}
              <button className="relative p-2.5 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <ShoppingCart className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* User Account Dropdown / Actions */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {user.userName}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block self-start mt-0.5">
                      {user.role}
                    </span>
                  </div>

                  {/* Panel Shortcut buttons depending on role */}
                  {(user.role === 'SELLER' || user.role === 'COMPANY_ADMIN' || user.role === 'seller') && (
                    <Link
                      to="/vendor"
                      title="لوحة البائع"
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Store className="w-5 h-5" />
                    </Link>
                  )}

                  {(user.role === 'SUPER_ADMIN' || user.role === 'admin') && (
                    <Link
                      to="/admin"
                      title="لوحة الإدارة"
                      className="p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Shield className="w-5 h-5" />
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    title="تسجيل الخروج"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
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

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search & Menu Expand */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white p-4 space-y-4 animate-fade-in">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتجات..."
                className="w-full pr-10 pl-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </form>

            <nav className="flex flex-col space-y-2 text-sm font-semibold">
              <Link to="/" className="px-3 py-2 rounded-lg hover:bg-slate-100">
                الرئيسية
              </Link>
              {isAuthenticated && (
                <>
                  <Link to="/vendor" className="px-3 py-2 rounded-lg hover:bg-slate-100">
                    لوحة البائع
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-right px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
                  >
                    تسجيل الخروج
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-sm border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* About */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold text-white">سوقنا</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                منصة التجارة الإلكترونية المتكاملة التي تجمع بين التنوع، الجودة، وسرعة التوصيل مع أعلى معايير الأمان.
              </p>
            </div>

            {/* Quick links */}
            <div className="space-y-3">
              <h4 className="text-white font-bold text-base">روابط سريعة</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    الرئيسية
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    تسجيل الدخول
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">
                    تسجيل حساب تاجر
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-3">
              <h4 className="text-white font-bold text-base">دعم العملاء</h4>
              <ul className="space-y-2 text-xs">
                <li>الأسئلة الشائعة</li>
                <li>سياسة الشحن والتوصيل</li>
                <li>سياسة الإرجاع والاستبدال</li>
                <li>حماية المشتري (Escrow)</li>
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <h4 className="text-white font-bold text-base">تواصل معنا</h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-500" />
                  <span>+20 100 000 0000</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <span>support@souqna.com</span>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span>القاهرة، مصر</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-12 pt-6 text-center text-xs text-slate-500">
            جميع الحقوق محفوظة © {new Date().getFullYear()} سوقنا - Souqna E-Commerce
          </div>
        </div>
      </footer>
    </div>
  );
};
