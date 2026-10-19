import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  useAuthStore,
  getVerifiedRole,
  getVerifiedPermissions,
} from '../store/useAuthStore';
import type { UserRole } from '../types/auth';

interface ProtectedRouteProps {
  allowedRoles?: (UserRole | string)[];
  requiredPermissions?: string[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  requiredPermissions,
  children,
}) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);

  // Securely retrieve and verify role directly against the cryptographically signed JWT token
  const verifiedRole = getVerifiedRole();

  if (!isAuthenticated || !token || !verifiedRole) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const currentRole = verifiedRole.toUpperCase();

  // Role validation check
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(
      (role) => role.toUpperCase() === currentRole,
    );

    if (!hasRole) {
      if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') {
        return <Navigate to="/admin" replace />;
      }
      if (currentRole === 'SELLER' || currentRole === 'COMPANY_ADMIN') {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser?.sellingEntityId) {
          return <Navigate to="/vendor/onboarding" replace />;
        }
        return <Navigate to="/vendor" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  // Prevent access to vendor dashboard without sellingEntityId
  const currentUser = useAuthStore.getState().user;
  if (
    (currentRole === 'SELLER' || currentRole === 'COMPANY_ADMIN') &&
    (location.pathname === '/vendor' ||
      location.pathname === '/vendor/' ||
      location.pathname.startsWith('/vendor/dashboard')) &&
    !currentUser?.sellingEntityId
  ) {
    return <Navigate to="/vendor/onboarding" replace />;
  }

  // Dynamic PBAC permission validation check
  if (requiredPermissions && requiredPermissions.length > 0) {
    const isSuperAdmin =
      currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';
    if (!isSuperAdmin) {
      const verifiedPerms = getVerifiedPermissions();
      const hasAllRequiredPermissions = requiredPermissions.every((perm) =>
        verifiedPerms.includes(perm),
      );
      if (!hasAllRequiredPermissions) {
        if (currentRole === 'SELLER' || currentRole === 'COMPANY_ADMIN') {
          return <Navigate to="/vendor" replace />;
        }
        return <Navigate to="/" replace />;
      }
    }
  }

  return children ? <>{children}</> : <Outlet />;
};