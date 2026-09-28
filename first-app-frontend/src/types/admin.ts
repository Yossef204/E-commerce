export interface PlatformKPIs {
  gmv: number;
  platformRevenue: number;
  activeEscrowBalance: number;
  activeStoresCount: number;
  completedOrdersCount: number;
  recentOrders: Array<{
    _id: string;
    customerId: string;
    totalAmount: number;
    currency: string;
    status: string;
    createdAt?: string;
  }>;
}

export type EntityStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';

export interface SellingEntityAdmin {
  _id: string;
  type: 'COMPANY' | 'INDEPENDENT_SELLER';
  primaryOwnerId: string;
  tradeName: string;
  status: EntityStatus;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  companyLegalName?: string;
  commercialRegisterNumber?: string;
  taxCardNumber?: string;
  sellerFullName?: string;
  nationalIdNumber?: string;
}

export type ProductApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface ProductVariantAdmin {
  _id: string;
  sku: string;
  price: number;
  attributes?: Record<string, string>;
  initialStock?: number;
}

export interface ProductModerationItem {
  _id: string;
  sellingEntityId: string;
  title: string;
  description: string;
  categoryId: string;
  brandId: string;
  approvalStatus: ProductApprovalStatus;
  rejectionReason?: string;
  variants: ProductVariantAdmin[];
  images?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type EscrowStatus = 'HELD' | 'RELEASED' | 'REFUNDED';

export interface EscrowLedgerItem {
  _id: string;
  mainOrderId: string;
  entityOrderId: string;
  sellingEntityId: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  status: EscrowStatus;
  releasedAt?: string;
  createdAt?: string;
}

export interface VendorPayoutSummary {
  sellingEntityId: string;
  summary: {
    totalGrossSales: number;
    totalPlatformFees: number;
    heldEscrowBalance: number;
    availablePayoutBalance: number;
    totalEscrowRecords: number;
    totalPayoutBatches: number;
  };
  payoutHistory: Array<{
    _id: string;
    sellingEntityId: string;
    escrowIds: string[];
    totalAmount: number;
    status: string;
    processedAt?: string;
    createdAt?: string;
  }>;
}

export interface AuditLogItem {
  _id: string;
  actorId: string;
  action: string;
  targetEntity: string;
  targetId: string;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  createdAt?: string;
}

export interface NotificationItem {
  _id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  channel: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt?: string;
}
