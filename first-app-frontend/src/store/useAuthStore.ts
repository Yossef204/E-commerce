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
 * Validates the local storage state against the actual verified JWT token.
 * If any tampering or token expiration is detected, wipes the state and returns null.
 */
export const getVerifiedRole = (): UserRole | null => {
  const state = useAuthStore.getState();
  const token = state.token;

  if (!token) {
    if (state.isAuthenticated || state.user) {
      state.clearAuth();
    }
    return null;
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    console.warn('Tampering or corrupt token detected. Clearing auth.');
    state.clearAuth();
    return null;
  }

  if (isTokenExpired(token)) {
    console.warn('Access token expired. Clearing auth.');
    state.clearAuth();
    return null;
  }

  const tokenRole = (payload.role || '').toUpperCase();
  const storedUserRole = (state.user?.role || '').toUpperCase();

  // If role in local storage was tampered with
  if (!state.user || tokenRole !== storedUserRole) {
    console.warn(
      `Role tampering detected! Stored role "${storedUserRole}" does not match token role "${tokenRole}". Resetting session.`,
    );
    state.clearAuth();
    return null;
  }

  return state.user.role;
};

/**
 * Validates and extracts verified permissions from the JWT payload.
 * If tampering is detected, wipes the session and returns an empty array.
 */
export const getVerifiedPermissions = (): string[] => {
  const state = useAuthStore.getState();
  const token = state.token;

  if (!token) {
    if (state.isAuthenticated || state.user) {
      state.clearAuth();
    }
    return [];
  }

  const payload = decodeJwtPayload(token);
  if (!payload || isTokenExpired(token)) {
    state.clearAuth();
    return [];
  }

  const tokenRole = (payload.role || '').toUpperCase();
  const storedUserRole = (state.user?.role || '').toUpperCase();

  if (!state.user || tokenRole !== storedUserRole) {
    console.warn('Tampering detected in permissions check. Clearing auth.');
    state.clearAuth();
    return [];
  }

  if (Array.isArray(payload.permissions)) {
    return payload.permissions;
  }

  if (Array.isArray(state.user.permissions)) {
    return state.user.permissions;
  }

  return [];
};

export const useAuthStore = create<AuthState>()(
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
