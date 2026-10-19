import React, { useState } from 'react';
import { ShoppingCart, Check, Package, Sparkles } from 'lucide-react';
import { useCartStore } from '../../../store/useCartStore';

export interface ProductVariant {
  _id?: string;
  sku: string;
  price: number;
  availableStock?: number;
  initialStock?: number;
  isActive?: boolean;
  images?: string[];
}

export interface Product {
  _id: string;
  title: string;
  description?: string;
  price?: number;
  sellingEntityId: string;
  vendorName?: string;
  variants?: ProductVariant[];
  images?: string[];
}

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCartStore();
  const [showToast, setShowToast] = useState(false);

  const defaultVariant = product.variants?.[0];
  const price = defaultVariant?.price ?? product.price ?? 0;
  const image =
    defaultVariant?.images?.[0] || product.images?.[0] || '';
  const stock =
    defaultVariant?.availableStock ?? defaultVariant?.initialStock ?? 99;
  const isOutOfStock = stock <= 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;

    addToCart({
      productId: product._id,
      variantSku: defaultVariant?.sku || 'DEFAULT',
      title: product.title,
      price: Number(price),
      sellingEntityId: product.sellingEntityId,
      quantity: 1,
      image,
      vendorName: product.vendorName,
    });

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between group relative">
      {/* Toast Notification Banner */}
      {showToast && (
        <div className="absolute top-3 left-3 right-3 z-20 bg-emerald-600 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-lg flex items-center justify-center gap-1.5 animate-bounce">
          <Check className="w-4 h-4 shrink-0" />
          <span>تمت الإضافة للسلة بنجاح</span>
        </div>
      )}

      {/* Product Image */}
      <div>
        <div className="h-52 bg-slate-50 relative flex items-center justify-center overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={product.title}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://placehold.co/400x400?text=Product';
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 gap-1">
              <Package className="w-12 h-12 stroke-[1.5]" />
              <span className="text-[11px] font-semibold text-slate-400">لا توجد صورة</span>
            </div>
          )}

          {isOutOfStock && (
            <span className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
              نفذت الكمية
            </span>
          )}

          {defaultVariant?.sku && (
            <span className="absolute bottom-2 left-2 bg-slate-900/70 backdrop-blur-sm text-slate-200 text-[9px] font-mono px-2 py-0.5 rounded">
              {defaultVariant.sku}
            </span>
          )}
        </div>

        {/* Product Details */}
        <div className="p-4 space-y-2">
          {product.vendorName && (
            <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {product.vendorName}
            </span>
          )}

          <h3
            title={product.title}
            className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors"
          >
            {product.title}
          </h3>

          {product.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>
      </div>

      {/* Card Footer: Price & Add to Cart */}
      <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold">السعر</span>
          <span className="font-extrabold text-slate-900 text-base">
            {Number(price).toFixed(2)} <span className="text-xs font-bold text-slate-600">ج.م</span>
          </span>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
            showToast
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : isOutOfStock
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-500/20 cursor-pointer'
          }`}
        >
          {showToast ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>أضيفت</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>أضف إلى السلة</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;

