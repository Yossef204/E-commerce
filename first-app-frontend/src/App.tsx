import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { StorefrontLayout } from './layouts/StorefrontLayout';
import { VendorLayout } from './layouts/VendorLayout';
import { HomePage } from './modules/storefront/HomePage';
import { Login } from './modules/auth/Login';
import { Register } from './modules/auth/Register';
import { VerifyOtp } from './modules/auth/VerifyOtp';
import { ProtectedRoute } from './routes/ProtectedRoute';

import { VendorDashboardPage } from './modules/vendor/pages/VendorDashboardPage';
import { VendorProductsPage } from './modules/vendor/pages/VendorProductsPage';
import { CreateProductPage } from './modules/vendor/pages/CreateProductPage';
import { VendorInventoryPage } from './modules/vendor/pages/VendorInventoryPage';
import { VendorOrdersPage } from './modules/vendor/pages/VendorOrdersPage';
import { VendorPayoutsPage } from './modules/vendor/pages/VendorPayoutsPage';
import { AdminDashboardPage } from './modules/admin/AdminDashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />

          {/* Vendor Protected Layout & Sub-routes */}
          <Route
            path="/vendor"
            element={
              <ProtectedRoute allowedRoles={['SELLER', 'COMPANY_ADMIN', 'seller']}>
                <VendorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<VendorDashboardPage />} />
            <Route path="products" element={<VendorProductsPage />} />
            <Route path="products/new" element={<CreateProductPage />} />
            <Route path="inventory" element={<VendorInventoryPage />} />
            <Route path="orders" element={<VendorOrdersPage />} />
            <Route path="payouts" element={<VendorPayoutsPage />} />
          </Route>

          {/* Storefront Layout & Sub-routes */}
          <Route path="/" element={<StorefrontLayout />}>
            <Route index element={<HomePage />} />

            {/* Admin Protected Route */}
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'admin']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
