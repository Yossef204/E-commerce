import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// متغيرات للتحكم في طابور الطلبات أثناء عملية التجديد
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 1. Request Interceptor: حقن الـ Access Token تلقائياً
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: اعتراض الخطأ 401 والتجديد التلقائي
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // التحقق من أن الخطأ هو 401 وأنه ليس طلب refresh-token نفسه لتجنب الحلقات اللانهائية
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh-token')
    ) {
      // إذا كانت عملية تجديد جارية بالفعل، ضع الطلب في قائمة الانتظار
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      // إذا لم يتوفر Refresh Token في الـ Store، اخرج فوراً لصفحة الدخول
      if (!refreshToken) {
        isRefreshing = false;
        useAuthStore.getState().clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        // استدعاء السيرفر لتجديد الـ Token باستخدام axios نظيف بدون interceptors
        const refreshResponse = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        // قراءة التوكن الجديد وفق شكل استجابة السيرفر
        const responseData = refreshResponse.data?.data || refreshResponse.data;
        const newAccessToken = responseData.accessToken || responseData.token;
        const newRefreshToken = responseData.refreshToken || refreshToken;

        // تحديث الـ Store بالتوكن الجديد
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

        // إطلاق الطلبات العالقة في الطابور باستخدام التوكن الجديد
        processQueue(null, newAccessToken);

        // إعادة تنفيذ الطلب الأصلي الذي فشل أول مرة
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // إذا فشل التجديد أيضاً (انتهاء صلاحية الـ Refresh Token)، يتم تفريغ الجلسة وتسجيل الخروج
        processQueue(refreshError, null);
        useAuthStore.getState().clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;