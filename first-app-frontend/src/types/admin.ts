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
  sellingEntityName?: string;
  tradeName?: string;
  title: string;
  description?: string;
  desc?: string;
  categoryId: string;
  categoryName?: string;
  brandId: string;
  brandName?: string;
  approvalStatus: ProductApprovalStatus;
  rejectionReason?: string;
  variants: ProductVariantAdmin[];
  images?: string[];
  image?: string;
  subImages?: string[];
  price?: number;
  stock?: number;
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

export interface CategoryAdmin {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  folderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorPeriodReport {
  sellingEntityId: string;
  tradeName: string;
  currency: string;
  period: string;
  startDate: string;
  endDate: string;
  grossSales: number;
  platformFees: number;
  totalRefundedAmount: number;
  netVendorEarnings: number;
  completedOrdersCount: number;
  refundsCount: number;
  totalOrdersCount: number;
  orders: Array<{
    entityOrderId: string;
    subtotal: number;
    commissionAmount?: number;
    status: string;
    createdAt: string;
  }>;
}

export interface VendorDecisionAnalytics {
  returnRate: {
    totalOrders: number;
    returnOrders: number;
    ratePercentage: number;
    status: 'NORMAL' | 'WARNING';
    badge: string;
    decision: string;
    isAlert: boolean;
  };
  codDebt: {
    totalCodSales: number;
    totalCodPlatformFees: number;
    availableBalance: number;
    outstandingCodDebt: number;
    threshold: number;
    status: 'SAFE' | 'CRITICAL';
    badge: string;
    decision: string;
    recommendSuspendCod: boolean;
    isAlert: boolean;
  };
  fulfillmentVelocity: {
    deliveredOrdersAnalyzed: number;
    averageDeliveryHours: number;
    averageDeliveryDays: number;
    status: 'EXCELLENT' | 'GOOD' | 'SLOW' | 'INSUFFICIENT_DATA';
    badge: string;
    decision: string;
    isTopSellerPriority: boolean;
  };
}

export interface VendorReportFullData {
  financialSummary: {
    sellingEntityId: string;
    tradeName: string;
    currency: string;
    summary: {
      totalGrossSales: number;
      totalPlatformFees: number;
      heldEscrowBalance: number;
      availablePayoutBalance: number;
      totalRefundDebits: number;
      totalPayoutDebits: number;
      totalCodPlatformFees: number;
      outstandingCodDebt: number;
      totalEscrowRecords: number;
      totalPayoutBatches: number;
      totalLedgerEntries: number;
    };
    payoutHistory: any[];
  };
  periodReport: VendorPeriodReport;
  decisionAnalytics: VendorDecisionAnalytics;
}

export interface AdminDashboardOverviewData {
  platformOverview: {
    totalOrders: number;
    gmv: number;
    totalUsers: number;
    totalSellers: number;
    activeStoresCount: number;
    usersByRole: Record<string, number>;
    currency: string;
  };
  approvalsCenter: {
    pendingCompanyRegistrations: number;
    pendingIndependentSellers: number;
    productsPendingApproval: number;
    totalPendingApprovals: number;
    requiresAttention: boolean;
  };
  financialHealth: {
    totalCollectedCommissions: number;
    totalHeldEscrow: number;
    pendingPayoutRequestsVolume: number;
    pendingPayoutRequestsCount: number;
    currency: string;
  };
  issuesAndFailures: {
    failedFinancialTransactions: number;
    unhandledWebhooks: number;
    pendingReturns: number;
    totalIssues: number;
    hasCriticalIssues: boolean;
  };
}


