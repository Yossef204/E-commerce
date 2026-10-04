import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, CartStore } from '../types/cart';

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (newItem: CartItem) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) =>
              i.productId === newItem.productId &&
              i.variantSku === newItem.variantSku
          );

          if (existingIndex > -1) {
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity:
                updatedItems[existingIndex].quantity + (newItem.quantity || 1),
            };
            return { items: updatedItems };
          }

          return { items: [...state.items, { ...newItem, quantity: newItem.quantity || 1 }] };
        });
      },

      removeFromCart: (productId: string, variantSku: string) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantSku === variantSku)
          ),
        }));
      },

      updateQuantity: (productId: string, variantSku: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeFromCart(productId, variantSku);
          return;
        }

        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantSku === variantSku
              ? { ...i, quantity }
              : i
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotalPrice: () => {
        return get().items.reduce(
          (acc, item) => acc + (Number(item.price) || 0) * item.quantity,
          0
        );
      },

      getTotalItems: () => {
        return get().items.reduce((acc, item) => acc + item.quantity, 0);
      },

      getItemsByVendor: () => {
        const items = get().items;
        return items.reduce((acc, item) => {
          const key = item.sellingEntityId || 'platform';
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(item);
          return acc;
        }, {} as Record<string, CartItem[]>);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
