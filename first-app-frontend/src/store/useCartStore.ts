import { create } from 'zustand';
import type { CartItem, CartStore } from '../types/cart';

/**
 * استخراج معرف المستخدم الحالي من التخزين المحلي لجلسة المصادقة
 */
export const getStoredUserId = (): string | null => {
  try {
    const rawAuth = localStorage.getItem('auth-storage');
    if (!rawAuth) return null;
    const parsed = JSON.parse(rawAuth);
    return (
      parsed?.state?.user?.id ||
      parsed?.state?.user?._id ||
      parsed?.state?.user?.sub ||
      null
    );
  } catch {
    return null;
  }
};

/**
 * تحديد مفتاح التخزين الخاص بالسلة:
 * cart_storage_${userId} للمستخدم المسجل
 * cart_storage_guest للزائر
 */
export const getCartStorageKey = (userId?: string | null): string => {
  const uid = userId !== undefined ? userId : getStoredUserId();
  return uid ? `cart_storage_${uid}` : 'cart_storage_guest';
};

const loadCartFromStorage = (key: string): CartItem[] => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.items)) return parsed.items;
    if (Array.isArray(parsed?.state?.items)) return parsed.state.items;
    return [];
  } catch {
    return [];
  }
};

const saveCartToStorage = (key: string, items: CartItem[]) => {
  try {
    localStorage.setItem(key, JSON.stringify({ items }));
  } catch (err) {
    console.error('فشل حفظ السلة في التخزين المحلي:', err);
  }
};

let activeUserId: string | null = getStoredUserId();
const initialKey = getCartStorageKey(activeUserId);
const initialItems = loadCartFromStorage(initialKey);

export const useCartStore = create<CartStore>()((set, get) => ({
  items: initialItems,

  addToCart: (newItem: CartItem) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (i) =>
          i.productId === newItem.productId &&
          i.variantSku === newItem.variantSku,
      );

      let updatedItems: CartItem[];
      if (existingIndex > -1) {
        updatedItems = [...state.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity:
            updatedItems[existingIndex].quantity + (newItem.quantity || 1),
        };
      } else {
        updatedItems = [
          ...state.items,
          { ...newItem, quantity: newItem.quantity || 1 },
        ];
      }

      const key = getCartStorageKey(activeUserId);
      saveCartToStorage(key, updatedItems);
      return { items: updatedItems };
    });
  },

  removeFromCart: (productId: string, variantSku: string) => {
    set((state) => {
      const updatedItems = state.items.filter(
        (i) => !(i.productId === productId && i.variantSku === variantSku),
      );
      const key = getCartStorageKey(activeUserId);
      saveCartToStorage(key, updatedItems);
      return { items: updatedItems };
    });
  },

  updateQuantity: (
    productId: string,
    variantSku: string,
    quantity: number,
  ) => {
    if (quantity <= 0) {
      get().removeFromCart(productId, variantSku);
      return;
    }

    set((state) => {
      const updatedItems = state.items.map((i) =>
        i.productId === productId && i.variantSku === variantSku
          ? { ...i, quantity }
          : i,
      );
      const key = getCartStorageKey(activeUserId);
      saveCartToStorage(key, updatedItems);
      return { items: updatedItems };
    });
  },

  /**
   * تفريغ السلة ومسح مفتاحها من التخزين المحلي
   */
  clearCart: () => {
    const key = getCartStorageKey(activeUserId);
    localStorage.removeItem(key);
    localStorage.removeItem('cart-storage');
    set({ items: [] });
  },

  /**
   * إعادة تعيين السلة لحالتها الافتراضية الفارغة عند تسجيل الخروج
   * ومسح أي مفاتيح متعلقة من localStorage
   */
  resetCart: () => {
    const key = getCartStorageKey(activeUserId);
    localStorage.removeItem(key);
    localStorage.removeItem('cart-storage');
    localStorage.removeItem('cart_storage_guest');
    activeUserId = null;
    set({ items: [] });
  },

  /**
   * تهيئة السلة الخاصة بالمستخدم فور تسجيل الدخول أو التبديل
   */
  initUserCart: (newUserId?: string | null) => {
    const uid = newUserId !== undefined ? newUserId : getStoredUserId();
    activeUserId = uid;
    const key = getCartStorageKey(uid);
    const loadedItems = loadCartFromStorage(key);
    set({ items: loadedItems });
  },

  getTotalPrice: () => {
    return get().items.reduce(
      (acc, item) => acc + (Number(item.price) || 0) * item.quantity,
      0,
    );
  },

  getTotalItems: () => {
    return get().items.reduce((acc, item) => acc + item.quantity, 0);
  },

  getItemsByVendor: () => {
    const items = get().items;
    return items.reduce(
      (acc, item) => {
        const key = item.sellingEntityId || 'platform';
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      },
      {} as Record<string, CartItem[]>,
    );
  },
}));
