import apiClient from './client';

export const orderApi = {
  // Verify COD OTP
  async verifyCodOtp(orderId: string, otp: string): Promise<any> {
    const res = await apiClient.post(`/orders/${orderId}/verify-cod-otp`, { otp });
    return res.data;
  },

  // Resend COD OTP
  async resendCodOtp(orderId: string): Promise<any> {
    const res = await apiClient.post(`/orders/${orderId}/resend-cod-otp`);
    return res.data;
  },
};

export default orderApi;

