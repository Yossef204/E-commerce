import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, UserRole } from '../types/auth';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  exp?: number;
  iat?: number;
}

export const parseJwt = (token: string): JwtPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'auth-storage',
    }
  )
);
