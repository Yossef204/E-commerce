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
    const res = await apiClient.get<{ success: boolean; data: Category[] }>('/categories');
    return res.data.data || [];
  },

  // Fetch brands list
  async getBrands(): Promise<Brand[]> {
    const res = await apiClient.get<{ success: boolean; data: Brand[] }>('/brands');
    return res.data.data || [];
  },
};

export default vendorApi;
