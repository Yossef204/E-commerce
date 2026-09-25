import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import type { UserRole } from '../types/auth';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const location = useLocation();
  const { isAuthenticated, token, user } = useAuthStore();

  if (!isAuthenticated || !token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(
      (role) => role.toUpperCase() === (user.role || '').toUpperCase()
    );

    if (!hasRole) {
      // Redirect based on current role if trying to access an unauthorized route
      if (user.role === 'SELLER' || user.role === 'COMPANY_ADMIN' || user.role === 'seller') {
        return <Navigate to="/vendor" replace />;
      }
      if (user.role === 'SUPER_ADMIN' || user.role === 'admin') {
        return <Navigate to="/admin" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
