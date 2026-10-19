import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, UserRole } from '../types/auth';
import {
  decodeJwtPayload,
  isTokenExpired,
  type DecodedJwtPayload,
} from '../utils/jwt.util';

export type JwtPayload = DecodedJwtPayload;

export const parseJwt = (token: string): JwtPayload | null => {
  return decodeJwtPayload(token);
};

export const getDecodedRole = (token: string | null): UserRole | null => {
  if (!token) return null;
  const decoded = decodeJwtPayload(token);
  return (decoded?.role as UserRole) || null;
};

/**
 * Validates the local storage state against the JWT payload.
 * Does NOT wipe the session if access token is expired as long as refreshToken exists.
 */
export const getVerifiedRole = (): UserRole | null => {
  const state = useAuthStore.getState();
  const token = state.token;

  if (!token) {
    if (state.isAuthenticated && !state.refreshToken) {
      state.clearAuth();
    }
    return null;
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    console.warn('Corrupt token detected.');
    if (!state.refreshToken) {
      state.clearAuth();
    }
    return null;
  }

  // إذا انتهى الـ Access Token ولكن يوجد Refresh Token، لا نمسح الجلسة
  // بل نرجع الدور المخزن مؤقتاً لحين اكتمال الـ Interceptor Refresh
  if (isTokenExpired(token)) {
    if (state.refreshToken && state.user?.role) {
      return state.user.role;
    }
    state.clearAuth();
    return null;
  }

  const tokenRole = (payload.role || '').toUpperCase();
  const storedUserRole = (state.user?.role || '').toUpperCase();

  if (!state.user || tokenRole !== storedUserRole) {
    console.warn(
      `Role tampering detected! Stored: "${storedUserRole}", Token: "${tokenRole}". Resetting.`,
    );
    state.clearAuth();
    return null;
  }

  return state.user.role;
};

/**
 * Validates and extracts verified permissions.
 */
export const getVerifiedPermissions = (): string[] => {
  const state = useAuthStore.getState();
  const token = state.token;

  if (!token) {
    if (state.isAuthenticated && !state.refreshToken) {
      state.clearAuth();
    }
    return [];
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    if (!state.refreshToken) state.clearAuth();
    return [];
  }

  if (isTokenExpired(token)) {
    // إرجاع الصلاحيات المخزنة مع المستخدم مؤقتاً إذا كان الـ Refresh متاحاً
    if (state.refreshToken && Array.isArray(state.user?.permissions)) {
      return state.user.permissions;
    }
    state.clearAuth();
    return [];
  }

  const tokenRole = (payload.role || '').toUpperCase();
  const storedUserRole = (state.user?.role || '').toUpperCase();

  if (!state.user || tokenRole !== storedUserRole) {
    state.clearAuth();
    return [];
  }

  const permissionsSet = new Set<string>();

  if (Array.isArray(payload.permissions)) {
    payload.permissions.forEach((p) => permissionsSet.add(p));
  }

  if (Array.isArray(state.user.permissions)) {
    state.user.permissions.forEach((p) => permissionsSet.add(p));
  }

  // Fallback defaults for SELLER and COMPANY_ADMIN
  if (tokenRole === 'SELLER' || tokenRole === 'COMPANY_ADMIN') {
    const sellerDefaults = [
      'products.create',
      'products.read_own',
      'products.update_own',
      'products.delete_own',
      'inventory.manage_own',
      'orders.seller_read',
      'orders.status_update',
      'coupons.manage_own',
      'analytics.read_own',
      'payout.request',
      'products.read',
      'products.update',
      'products.delete',
      'inventory.manage',
    ];
    sellerDefaults.forEach((p) => permissionsSet.add(p));
  }

  return Array.from(permissionsSet);
};

interface ExtendedAuthState extends AuthState {
  setTokens: (token: string, refreshToken?: string) => void;
}

export const useAuthStore = create<ExtendedAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      sessionId: null,
      user: null,
      isAuthenticated: false,

      setAuth: ({ token, refreshToken, sessionId, user }) => {
        set({
          token,
          refreshToken: refreshToken || null,
          sessionId: sessionId || null,
          user,
          isAuthenticated: true,
        });
      },

      // دالة التحديث السريع للـ Tokens الناتجة عن الـ Refresh
      setTokens: (token: string, refreshToken?: string) => {
        set((state) => ({
          token,
          refreshToken: refreshToken || state.refreshToken,
          isAuthenticated: true,
        }));
      },

      updateUser: (updatedFields) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null,
        }));
      },

      clearAuth: () => {
        set({
          token: null,
          refreshToken: null,
          sessionId: null,
          user: null,
          isAuthenticated: false,
        });
      },

      logout: () => {
        get().clearAuth();
      },

      getVerifiedRole: () => {
        return getVerifiedRole();
      },

      getVerifiedPermissions: () => {
        return getVerifiedPermissions();
      },
    }),
    {
      name: 'auth-storage',
    },
  ),
);