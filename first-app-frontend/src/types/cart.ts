export interface CartItem {
  productId: string;
  variantSku: string;
  title: string;
  price: number;
  sellingEntityId: string;
  quantity: number;
  image?: string;
  vendorName?: string;
}

export interface CartStore {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, variantSku: string) => void;
  updateQuantity: (productId: string, variantSku: string, quantity: number) => void;
  clearCart: () => void;
  resetCart: () => void;
  initUserCart: (userId?: string | null) => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  getItemsByVendor: () => Record<string, CartItem[]>;
}
