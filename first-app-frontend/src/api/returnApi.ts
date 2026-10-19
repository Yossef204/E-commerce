import apiClient from './client';
import type {
  ReturnRequest,
  CreateReturnRequestPayload,
  InspectReturnPayload,
  VendorReturnsListResponse,
} from '../types/return';

export const returnApi = {
  // Customer submits return request
  async requestReturn(payload: CreateReturnRequestPayload): Promise<ReturnRequest> {
    const res = await apiClient.post<ReturnRequest>('/returns/request', payload);
    return res.data;
  },

  // Customer retrieves own return requests
  async getMyReturns(): Promise<ReturnRequest[]> {
    const res = await apiClient.get<ReturnRequest[]>('/returns/my-returns');
    return Array.isArray(res.data) ? res.data : [];
  },

  // Vendor retrieves return requests for their selling entity
  async getVendorReturns(
    sellingEntityId: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<VendorReturnsListResponse> {
    const res = await apiClient.get<VendorReturnsListResponse>(
      `/returns/vendor/${sellingEntityId}`,
      { params }
    );
    return res.data;
  },

  // Vendor or Admin inspects and approves or rejects
  async inspectReturn(
    returnId: string,
    payload: InspectReturnPayload
  ): Promise<ReturnRequest> {
    const res = await apiClient.patch<ReturnRequest>(
      `/returns/${returnId}/inspect`,
      payload
    );
    return res.data;
  },

  // Vendor or Admin processes refund, restock & ledger debit
  async processRefund(returnId: string): Promise<any> {
    const res = await apiClient.post(`/returns/${returnId}/refund`);
    return res.data;
  },
};

export default returnApi;

