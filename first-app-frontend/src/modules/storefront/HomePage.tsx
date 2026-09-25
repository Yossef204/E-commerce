import React from 'react';
import { ShoppingBag, ShieldCheck, Zap, Truck, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-12 pb-12" dir="rtl">
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white rounded-3xl p-8 md:p-14 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="relative z-10 max-w-2xl space-y-6">
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-blue-100 text-xs font-semibold px-4 py-1.5 rounded-full border border-white/20">
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            عروض حصرية لفترة محدودة
          </span>
          <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight">
            أفضل المنتجات العالمية بأفضل الأسعار والتوصيل السريع
          </h1>
          <p className="text-blue-100 text-base md:text-lg leading-relaxed">
            اكتشف آلاف المنتجات من مختلف الفئات: إلكترونيات، أزياء، مستلزمات منزلية، والمزيد مع ضمان الجودة 100%.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-7 py-3.5 rounded-xl shadow-lg transition-all text-sm">
              تسوق الآن
            </button>
            <Link
              to="/register"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-xl border border-white/20 backdrop-blur-md transition-all text-sm"
            >
              افتح متجرك مجاناً
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">شحن سريع وآمن</h3>
            <p className="text-slate-500 text-xs mt-1">توصيل لجميع المحافظات خلال 24-48 ساعة</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">دفع محمي 100%</h3>
            <p className="text-slate-500 text-xs mt-1">نظام Escrow يضمن لك استرداد أموالك</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-xl">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">خصومات يومية</h3>
            <p className="text-slate-500 text-xs mt-1">أسعار تنافسية وعروض لا تتكرر يومياً</p>
          </div>
        </div>
      </section>

      {/* Featured Products Placeholder */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            المنتجات الأكثر مبيعاً
          </h2>
          <span className="text-sm font-bold text-blue-600 hover:underline cursor-pointer">
            عرض الكل ←
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all group"
            >
              <div className="h-48 bg-slate-100 relative flex items-center justify-center text-slate-400 font-semibold">
                صورة المنتج #{item}
              </div>
              <div className="p-5 space-y-2">
                <span className="text-xs text-blue-600 font-bold">إلكترونيات</span>
                <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                  منتج تجريبي مميز #{item}
                </h3>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-extrabold text-slate-900 text-lg">299 ج.م</span>
                  <button className="bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                    إضافة للسلة
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

