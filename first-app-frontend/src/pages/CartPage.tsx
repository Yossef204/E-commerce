import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { useCartStore } from '../store/useCartStore';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalPrice,
    getTotalItems,
  } = useCartStore();

  const totalPrice = getTotalPrice();
  const totalItems = getTotalItems();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-6" dir="rtl">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
          <ShoppingBag className="w-12 h-12 stroke-[1.5]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-slate-800">
            سلتك فارغة حالياً
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            لم تقم بإضافة أي منتجات إلى سلة المشتريات بعد. استكشف مجموعتنا الواسعة وابدأ التسوق الآن!
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all text-sm"
        >
          <span>تصفح المنتجات</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-blue-600" />
            عربة التسوق
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            لديك <span className="font-bold text-blue-600">{totalItems}</span> منتجات في السلة
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          <span>إفراغ السلة</span>
        </button>
      </div>

      {/* Main Grid: Items + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const lineTotal = (Number(item.price) || 0) * item.quantity;
            return (
              <div
                key={`${item.productId}-${item.variantSku}`}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 hover:shadow-sm transition-all"
              >
                {/* Product Image */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-slate-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 text-center sm:text-right space-y-1">
                  {item.vendorName && (
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block">
                      البائع: {item.vendorName}
                    </span>
                  )}
                  <h3 className="font-bold text-slate-800 text-sm leading-snug">
                    {item.title}
                  </h3>
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400 font-mono">
                    <span>SKU: {item.variantSku}</span>
                    <span>•</span>
                    <span className="text-slate-600 font-semibold font-sans">
                      {Number(item.price).toFixed(2)} ج.م للقطعة
                    </span>
                  </div>
                </div>

                {/* Quantity Controls & Line Total */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 block font-bold">الإجمالي</span>
                    <span className="font-black text-slate-900 text-base">
                      {lineTotal.toFixed(2)}{' '}
                      <span className="text-xs font-bold text-slate-600">ج.م</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.variantSku,
                            item.quantity - 1
                          )
                        }
                        className="p-1.5 hover:bg-slate-200 text-slate-600 transition-colors"
                        title="تقليل الكمية"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1 font-bold text-slate-800 text-xs min-w-[28px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.variantSku,
                            item.quantity + 1
                          )
                        }
                        className="p-1.5 hover:bg-slate-200 text-slate-600 transition-colors"
                        title="زيادة الكمية"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        removeFromCart(item.productId, item.variantSku)
                      }
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="حذف من السلة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <h2 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              ملخص الطلب
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>إجمالي المنتجات ({totalItems})</span>
                <span className="font-bold text-slate-900">
                  {totalPrice.toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>رسوم التوصيل</span>
                <span className="font-bold text-emerald-600">
                  {totalPrice >= 500 ? 'مجاناً' : '50.00 ج.م'}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                <span className="font-bold text-slate-900">المجموع الكلي</span>
                <span className="font-black text-2xl text-blue-600">
                  {(totalPrice + (totalPrice >= 500 ? 0 : 50)).toFixed(2)}{' '}
                  <span className="text-xs font-bold text-slate-600">ج.م</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <span>المتابعة لإتمام الطلب</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>

            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>دفع آمن 100% مع حماية المشتري Escrow</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
