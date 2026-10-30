import { apiClient } from '../api/client';

export interface RegisterSellerPayload {
  userName: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: 'SELLER' | 'COMPANY_ADMIN' | 'seller' | 'company_admin';
  storeName: string;
  description?: string;
  businessType?: 'COMPANY' | 'INDEPENDENT_SELLER' | string;
  taxOrCommercialNumber: string;
  documentUrl?: string;
}

export const authService = {
  async registerSeller(data: RegisterSellerPayload) {
    const response = await apiClient.post('/auth/register-seller', data);
    return response.data;
  },

  async register(data: any) {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  async login(data: any) {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  async verifyOtp(data: any) {
    const response = await apiClient.post('/auth/verify-otp', data);
    return response.data;
  },
};

export const registerSeller = authService.registerSeller;
export default authService;

