import apiClient from './client';
import type {
  PlatformKPIs,
  SellingEntityAdmin,
  ProductModerationItem,
  EscrowLedgerItem,
  VendorPayoutSummary,
  AuditLogItem,
  NotificationItem,
} from '../types/admin';

export const adminApi = {
  async getPlatformKPIs(): Promise<PlatformKPIs> {
    const res = await apiClient.get<{ success: boolean; data: PlatformKPIs }>('/payments/kpis');
    return res.data.data;
  },

  async getSellingEntities(): Promise<SellingEntityAdmin[]> {
    const res = await apiClient.get<{ success: boolean; data: SellingEntityAdmin[] }>(
      '/selling-entities'
    );
    return res.data.data || [];
  },

  async updateEntityStatus(
    id: string,
    status: string,
    rejectionReason?: string
  ): Promise<SellingEntityAdmin> {
    const res = await apiClient.patch<{ message: string; data: SellingEntityAdmin }>(
      `/selling-entities/${id}/status`,
      { status, rejectionReason }
    );
    return res.data.data;
  },

  async getProductsForModeration(approvalStatus?: string): Promise<ProductModerationItem[]> {
    const res = await apiClient.get<{ success: boolean; data: ProductModerationItem[] }>(
      '/products',
      {
        params: approvalStatus ? { approvalStatus } : undefined,
      }
    );
    return res.data.data || [];
  },

  async updateProductApproval(
    id: string,
    approvalStatus: string,
    rejectionReason?: string
  ): Promise<ProductModerationItem> {
    const res = await apiClient.patch<{ message: string; data: ProductModerationItem }>(
      `/products/${id}/approval`,
      { approvalStatus, rejectionReason }
    );
    return res.data.data;
  },

  async getEscrowLedgers(): Promise<EscrowLedgerItem[]> {
    const res = await apiClient.get<{ success: boolean; data: EscrowLedgerItem[] }>(
      '/payments/escrow'
    );
    return res.data.data || [];
  },

  async releaseEscrow(entityOrderId: string): Promise<any> {
    const res = await apiClient.post('/payments/escrow/release', { entityOrderId });
    return res.data;
  },

  async getSellerFinancialSummary(sellingEntityId: string): Promise<VendorPayoutSummary> {
    const res = await apiClient.get<VendorPayoutSummary>(
      `/payments/summary/${sellingEntityId}`
    );
    return res.data;
  },

  async processVendorPayout(sellingEntityId: string): Promise<any> {
    const res = await apiClient.post('/payments/payout', { sellingEntityId });
    return res.data;
  },

  async getAuditLogs(targetEntity?: string, actorId?: string): Promise<AuditLogItem[]> {
    let url = '/audit-logs';
    if (targetEntity) {
      url = `/audit-logs/entity/${targetEntity}`;
    } else if (actorId) {
      url = `/audit-logs/actor/${actorId}`;
    }
    const res = await apiClient.get<AuditLogItem[] | { success: boolean; data: AuditLogItem[] }>(url);
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return res.data.data || [];
  },

  async getMyNotifications(): Promise<NotificationItem[]> {
    const res = await apiClient.get<NotificationItem[] | { success: boolean; data: NotificationItem[] }>(
      '/notifications/my-notifications'
    );
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return res.data.data || [];
  },

  async markNotificationAsRead(id: string): Promise<any> {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },
};

export default adminApi;
