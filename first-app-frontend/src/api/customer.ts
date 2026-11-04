import { apiClient } from './axios';

export const customerApi = {
  // جلب المنتجات
  getProducts: () => apiClient.get('/products'),

  // جلب السلة
  getCart: () => apiClient.get('/cart'),

  // بدء عملية الدفع وإنشاء الـ Payment Key
  initiatePayment: (orderData: any) =>
    apiClient.post('/payments/paymob/initiate', orderData),
};