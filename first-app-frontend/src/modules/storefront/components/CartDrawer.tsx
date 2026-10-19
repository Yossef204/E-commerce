import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  ShoppingBag,
} from 'lucide-react';
import { useCartStore } from '../../../store/useCartStore';
import { getImageUrl, handleImageError } from '../../../utils/imageHelper';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, getTotalPrice, getTotalItems } =
    useCartStore();

  if (!isOpen) return null;

  const totalAmount = getTotalPrice();
  const totalItems = getTotalItems();

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  const handleViewCart = () => {
    onClose();
    navigate('/cart');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between transform transition-transform">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">سلة المشتريات</h2>
                <p className="text-xs text-slate-500">
                  {totalItems > 0 ? `${totalItems} منتجات مضافة` : 'السلة فارغة'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="إغلاق السلة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                  <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">سلتك فارغة تماماً</h3>
                <p className="text-xs text-slate-500 max-w-xs mb-6">
                  استكشف أحدث المنتجات والعروض الرائعة وأضف ما يعجبك إلى السلة!
                </p>
                <button
                  onClick={() => {
                    onClose();
                    navigate('/');
                  }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all"
                >
                  تسوق الآن
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantSku}`}
                  className="flex gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all"
                >
                  {/* Item Image with Fallback */}
                  <div className="w-20 h-20 bg-slate-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-slate-100 relative">
                    <img
                      src={getImageUrl(item.image)}
                      alt={item.title}
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                          {item.title}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.productId, item.variantSku)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                          title="حذف من السلة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {item.variantSku && (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          SKU: {item.variantSku}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                      <span className="text-xs font-black text-blue-600">
                        {(item.price * item.quantity).toLocaleString()} ج.م
                      </span>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantSku, item.quantity - 1)
                          }
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded transition-colors"
                          aria-label="تقليل الكمية"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantSku, item.quantity + 1)
                          }
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded transition-colors"
                          aria-label="زيادة الكمية"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-100 bg-slate-50/70 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">المجموع الفرعي:</span>
                <span className="text-base font-black text-slate-900">
                  {totalAmount.toLocaleString()} ج.م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleViewCart}
                  className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors text-center"
                >
                  عرض السلة كاملة
                </button>
                <button
                  onClick={handleCheckout}
                  className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>متابعة الشراء</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={clearCart}
                className="w-full text-center text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
              >
                تفريغ محتويات السلة
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

