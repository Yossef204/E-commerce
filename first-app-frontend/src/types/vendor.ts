export type EntityType = 'INDEPENDENT_SELLER' | 'COMPANY';
export type EntityStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type ProductApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type EntityOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface SellingEntity {
  _id: string;
  legalName?: string;
  tradeName: string;
  type: EntityType;
  status: EntityStatus;
  rejectionReason?: string;
  primaryOwnerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Variant {
  _id?: string;
  sku: string;
  price: number;
  isActive: boolean;
  attributes?: Record<string, string>;
  availableStock?: number;
  initialStock?: number;
}

export interface VendorProduct {
  _id: string;
  title: string;
  description: string;
  categoryId: string;
  brandId: string;
  sellingEntityId: string;
  approvalStatus: ProductApprovalStatus;
  rejectionReason?: string;
  variants: Variant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  sku: string;
  variantId: string;
  titleSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface StatusHistoryEntry {
  status: EntityOrderStatus;
  updatedAt: string;
  note?: string;
}

export interface VendorOrder {
  _id: string;
  mainOrderId: string;
  sellingEntityId: string;
  items: OrderItem[];
  subtotal: number;
  status: EntityOrderStatus;
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorDashboardMetrics {
  totalSales: number;
  pendingOrdersCount: number;
  activeProductsCount: number;
  escrowBalance: number;
  availablePayoutBalance: number;
}

export interface VendorDashboardData {
  entity: SellingEntity;
  metrics: VendorDashboardMetrics;
  recentOrders: VendorOrder[];
}

export interface CreateVariantInput {
  sku: string;
  price: number;
  initialStock: number;
}

export interface CreateProductPayload {
  title: string;
  description: string;
  categoryId: string;
  brandId: string;
  sellingEntityId: string;
  variants: CreateVariantInput[];
}

export interface UpdateInventoryPayload {
  sku: string;
  quantity: number;
  operation: 'ADD' | 'SET';
}

export interface Category {
  _id: string;
  name: string;
  slug?: string;
}

export interface Brand {
  _id: string;
  name: string;
  slug?: string;
}
