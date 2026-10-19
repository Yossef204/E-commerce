import apiClient from './client';
import type {
  SellingEntity,
  VendorDashboardData,
  VendorProduct,
  VendorOrder,
  CreateProductPayload,
  UpdateInventoryPayload,
  Category,
  Brand,
  SellerPayoutMethod,
  PayoutMethodType,
  PayoutMethodDetails,
  LedgerEntry,
  WalletBalanceSummary,
  PayoutRequestItem,
} from '../types/vendor';

export const vendorApi = {
  // Fetch vendor entity profile for a given user ID
  async getProfile(ownerId: string): Promise<SellingEntity> {
    const res = await apiClient.get<{ success: boolean; data: SellingEntity }>(
      `/selling-entities/profile/${ownerId}`
    );
    return res.data.data;
  },

  // Fetch composite dashboard metrics for a given selling entity ID
  async getDashboardMetrics(sellingEntityId: string): Promise<VendorDashboardData> {
    const res = await apiClient.get<{ success: boolean; data: VendorDashboardData }>(
      `/selling-entities/${sellingEntityId}/dashboard-metrics`
    );
    return res.data.data;
  },

  // Fetch all products belonging to a selling entity
  async getEntityProducts(sellingEntityId: string): Promise<VendorProduct[]> {
    const res = await apiClient.get<{ success: boolean; data: VendorProduct[] }>(
      `/products/entity/${sellingEntityId}`
    );
    return res.data.data;
  },

  // Create a new product
  async createProduct(payload: CreateProductPayload): Promise<VendorProduct> {
    const res = await apiClient.post<{ message: string; data: VendorProduct }>(
      '/products',
      payload
    );
    return res.data.data;
  },

  // Update stock level for a specific SKU
  async updateInventoryStock(payload: UpdateInventoryPayload): Promise<any> {
    const res = await apiClient.patch('/products/inventory/stock', payload);
    return res.data;
  },

  // Fetch entity sub-orders
  async getEntityOrders(sellingEntityId: string): Promise<VendorOrder[]> {
    const res = await apiClient.get<{ success: boolean; data: VendorOrder[] }>(
      `/orders/entity/${sellingEntityId}`
    );
    return res.data.data;
  },

  // Update order shipment status
  async updateOrderStatus(
    orderId: string,
    status: string,
    note?: string
  ): Promise<VendorOrder> {
    const res = await apiClient.patch<{ message: string; data: VendorOrder }>(
      `/orders/entity-orders/${orderId}/status`,
      { status, note }
    );
    return res.data.data;
  },

  // Fetch seller financial summary (escrow & payouts)
  async getFinancialSummary(sellingEntityId: string): Promise<any> {
    const res = await apiClient.get(`/payments/summary/${sellingEntityId}`);
    return res.data;
  },

  // Fetch categories list
  async getCategories(): Promise<Category[]> {
    const res = await apiClient.get<any>('/category');
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data?.data && Array.isArray(res.data.data)) {
      return res.data.data;
    }
    return [];
  },

  // Fetch brands list
  async getBrands(): Promise<Brand[]> {
    const res = await apiClient.get<any>('/brand');
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data?.data && Array.isArray(res.data.data)) {
      return res.data.data;
    }
    return [];
  },

  // Fetch seller wallet balance summary (pending, available, withdrawn)
  async getWalletBalance(sellingEntityId?: string): Promise<WalletBalanceSummary> {
    const res = await apiClient.get<{ success: boolean; data: WalletBalanceSummary }>(
      '/seller/wallet/balance',
      { params: sellingEntityId ? { sellingEntityId } : undefined }
    );
    return res.data.data;
  },

  // Fetch paginated ledger entries
  async getLedgerEntries(params?: {
    sellingEntityId?: string;
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    entries: LedgerEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const res = await apiClient.get<any>('/seller/wallet/ledger', { params });
    return res.data;
  },

  // Fetch all seller payout methods
  async getPayoutMethods(sellingEntityId?: string): Promise<SellerPayoutMethod[]> {
    const res = await apiClient.get<{ success: boolean; data: SellerPayoutMethod[] }>(
      '/seller/payout-methods',
      { params: sellingEntityId ? { sellingEntityId } : undefined }
    );
    return res.data.data;
  },

  // Add new payout method
  async createPayoutMethod(payload: {
    type: PayoutMethodType;
    details: PayoutMethodDetails;
    isDefault?: boolean;
    sellingEntityId?: string;
  }): Promise<SellerPayoutMethod> {
    const res = await apiClient.post<{ success: boolean; message: string; data: SellerPayoutMethod }>(
      '/seller/payout-methods',
      payload
    );
    return res.data.data;
  },

  // Set default payout method
  async setDefaultPayoutMethod(
    methodId: string,
    sellingEntityId?: string
  ): Promise<SellerPayoutMethod> {
    const res = await apiClient.patch<{ success: boolean; message: string; data: SellerPayoutMethod }>(
      `/seller/payout-methods/${methodId}/default`,
      null,
      { params: sellingEntityId ? { sellingEntityId } : undefined }
    );
    return res.data.data;
  },

  // Request seller payout
  async requestPayout(payload: {
    amount: number;
    payoutMethodId: string;
    sellingEntityId?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    payoutRequest: PayoutRequestItem;
    gatewayReference: string;
    newBalance: number;
  }> {
    const res = await apiClient.post<any>('/seller/payouts/request', payload);
    return res.data;
  },

  // Get payout requests history
  async getPayoutHistory(sellingEntityId?: string): Promise<PayoutRequestItem[]> {
    const res = await apiClient.get<{ success: boolean; data: PayoutRequestItem[] }>(
      '/seller/payouts',
      { params: sellingEntityId ? { sellingEntityId } : undefined }
    );
    return res.data.data;
  },

  // Get vendor returns
  async getVendorReturns(
    sellingEntityId: string,
    params?: { page?: number; limit?: number; status?: string }
  ) {
    const res = await apiClient.get(`/returns/vendor/${sellingEntityId}`, { params });
    return res.data;
  },

  // Inspect and update return status
  async inspectReturnRequest(
    returnId: string,
    payload: {
      status: string;
      inspectionResult?: string;
      vendorNote?: string;
      rejectionReason?: string;
    }
  ) {
    const res = await apiClient.patch(`/returns/${returnId}/inspect`, payload);
    return res.data;
  },

  // Process refund for an inspected return
  async processRefund(returnId: string) {
    const res = await apiClient.post(`/returns/${returnId}/refund`);
    return res.data;
  },
};

export default vendorApi;
