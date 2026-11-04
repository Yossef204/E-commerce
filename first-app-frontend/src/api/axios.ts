import axios from 'axios';

// قراءة الرابط من .env مع fallback لرابط ngrok
const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://meadow-unfactual-hyun.ngrok-free.dev';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // تخطي شاشة حماية ngrok تلقائياً
  },
  withCredentials: true,
});

// Interceptor لإضافة التوكن تلقائياً مع كل طلب
apiClient.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('token') || localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);