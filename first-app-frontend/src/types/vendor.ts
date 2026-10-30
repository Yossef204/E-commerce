export type EntityType = 'INDEPENDENT_SELLER' | 'COMPANY';
export type EntityStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'DEACTIVATED';
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
  brand?: Brand | null;
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
  images?: string[];
  image?: string;
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
  description?: string;
  image?: string;
}

export interface Brand {
  _id: string;
  name: string;
  slug?: string;
}

export type PayoutMethodType = 'BANK_ACCOUNT' | 'VODAFONE_CASH' | 'INSTAPAY';

export interface PayoutMethodDetails {
  accountHolderName?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  walletNumber?: string;
  instaPayAddress?: string;
  [key: string]: any;
}

export interface SellerPayoutMethod {
  _id: string;
  sellingEntityId: string;
  type: PayoutMethodType;
  details: PayoutMethodDetails;
  isDefault: boolean;
  isVerified: boolean;
  createdAt?: string;
}

export type LedgerMovementType =
  | 'ORDER_CREDIT'
  | 'PLATFORM_FEE_DEBIT'
  | 'PAYOUT_DEBIT'
  | 'REFUND_DEBIT';

export type LedgerEntryStatus =
  | 'HELD_ESCROW'
  | 'AVAILABLE'
  | 'SETTLED'
  | 'CANCELLED';

export interface LedgerEntry {
  _id: string;
  sellingEntityId: string;
  orderId?: any;
  entityOrderId?: any;
  entryType: LedgerMovementType;
  account?: string;
  type?: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  status: LedgerEntryStatus;
  paymentMethod?: string;
  reference?: string;
  description: string;
  createdAt: string;
}

export interface WalletBalanceSummary {
  pendingBalance: number;
  availableBalance: number;
  withdrawnBalance: number;
  platformDues?: number;
  currency: string;
}

export interface PayoutRequestItem {
  _id: string;
  sellingEntityId: string;
  amount: number;
  payoutMethodId: string;
  payoutMethodSnapshot: {
    type: PayoutMethodType;
    details: PayoutMethodDetails;
  };
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  gatewayReference?: string;
  requestedAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export interface CompanyDashboardOverviewData {
  salesSummary: {
    period: string;
    startDate: string;
    totalSales: number;
    ordersCount: number;
    avgOrderValue: number;
    currency: string;
  };
  ordersRequiringAction: {
    pending: number;
    confirmed: number;
    processing: number;
    total: number;
  };
  pendingApprovals: {
    pendingProductsCount: number;
    requiresAction: boolean;
  };
  lowStockAlerts: {
    threshold: number;
    count: number;
    items: Array<{
      _id: string;
      sku: string;
      availableStock: number;
      productId: string;
      productTitle: string;
    }>;
    hasAlert: boolean;
  };
  financialBalances: {
    heldEscrowBalance: number;
    availablePayoutBalance: number;
    codDebt: number;
    currency: string;
  };
}

