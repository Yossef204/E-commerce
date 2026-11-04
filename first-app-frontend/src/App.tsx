import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from './api/graphqlClient';

import { StorefrontLayout } from './layouts/StorefrontLayout';
import { VendorLayout } from './layouts/VendorLayout';
import { AdminLayout } from './layouts/AdminLayout';

import { HomePage } from './modules/storefront/HomePage';
import { ProductDetailsPage } from './modules/storefront/pages/ProductDetailsPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MyOrdersPage } from './modules/storefront/pages/MyOrdersPage';
import { Login } from './modules/auth/Login';
import { Register } from './modules/auth/Register';
import { SellerRegisterPage } from './modules/auth/SellerRegisterPage';
import { SellerPendingApprovalPage } from './modules/seller/SellerPendingApprovalPage';
import { VerifyOtp } from './modules/auth/VerifyOtp';
import { ForgotPassword } from './modules/auth/ForgotPassword';
import { ResetPassword } from './modules/auth/ResetPassword';
import { ProfilePage } from './modules/storefront/pages/ProfilePage';
import { OrderSuccessPage } from './modules/storefront/pages/OrderSuccessPage';
import { PaymobTestPage } from './pages/PaymobTestPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

import { VendorOnboardingPage } from './modules/vendor/pages/VendorOnboardingPage';
import { VendorDashboardPage } from './modules/vendor/pages/VendorDashboardPage';
import { VendorProductsPage } from './modules/vendor/pages/VendorProductsPage';
import { CreateProductPage } from './modules/vendor/pages/CreateProductPage';
import { VendorInventoryPage } from './modules/vendor/pages/VendorInventoryPage';
import { VendorOrdersPage } from './modules/vendor/pages/VendorOrdersPage';
import { VendorCouponsPage } from './modules/vendor/pages/VendorCouponsPage';
import { VendorPayoutsPage } from './modules/vendor/pages/VendorPayoutsPage';
import { VendorReturnsPage } from './modules/vendor/pages/VendorReturnsPage';

import { AdminDashboardPage } from './modules/admin/pages/AdminDashboardPage';
import { EntityApprovalsPage } from './modules/admin/pages/EntityApprovalsPage';
import { ProductModerationPage } from './modules/admin/pages/ProductModerationPage';
import { AdminFinancePage } from './modules/admin/pages/AdminFinancePage';
import { PermissionsPage } from './modules/admin/pages/PermissionsPage';
import { AuditLogsPage } from './modules/admin/pages/AuditLogsPage';
import { AdminCategoriesPage } from './modules/admin/pages/AdminCategoriesPage';

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
    <ApolloProvider client={apolloClient}>
      <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-seller" element={<SellerRegisterPage />} />
          <Route path="/seller/pending-approval" element={<SellerPendingApprovalPage />} />
          <Route path="/vendor/pending-approval" element={<SellerPendingApprovalPage />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/paymob-test" element={<PaymobTestPage />} />

          {/* Vendor Onboarding Route */}
          <Route
            path="/vendor/onboarding"
            element={
              <ProtectedRoute allowedRoles={['SELLER', 'COMPANY_ADMIN', 'seller', 'company_admin']}>
                <VendorOnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Vendor Protected Layout & Sub-routes */}
          <Route
            path="/vendor"
            element={
              <ProtectedRoute allowedRoles={['SELLER', 'COMPANY_ADMIN', 'seller', 'company_admin']}>
                <VendorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<VendorDashboardPage />} />
            <Route path="dashboard" element={<VendorDashboardPage />} />
            <Route path="products" element={<VendorProductsPage />} />
            <Route path="products/new" element={<CreateProductPage />} />
            <Route path="inventory" element={<VendorInventoryPage />} />
            <Route path="orders" element={<VendorOrdersPage />} />
            <Route path="returns" element={<VendorReturnsPage />} />
            <Route path="coupons" element={<VendorCouponsPage />} />
            <Route path="payouts" element={<VendorPayoutsPage />} />
            <Route path="finance" element={<VendorPayoutsPage />} />
            <Route path="wallet" element={<VendorPayoutsPage />} />
          </Route>

          <Route path="/seller/dashboard" element={<Navigate to="/vendor/dashboard" replace />} />
          <Route path="/seller" element={<Navigate to="/vendor/dashboard" replace />} />
          <Route path="/seller/finance" element={<Navigate to="/vendor/payouts" replace />} />
          <Route path="/seller/wallet" element={<Navigate to="/vendor/payouts" replace />} />

          {/* Super Admin Protected Layout & Sub-routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'SUPER_ADMIN', 'admin', 'ADMIN', 'superadmin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="entities" element={<EntityApprovalsPage />} />
            <Route path="products" element={<ProductModerationPage />} />
            <Route path="permissions" element={<PermissionsPage />} />
            <Route path="finance" element={<AdminFinancePage />} />
            <Route path="financials" element={<AdminFinancePage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>

          {/* Storefront Layout & Sub-routes */}
          <Route path="/" element={<StorefrontLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<HomePage />} />
            <Route path="product/:id" element={<ProductDetailsPage />} />
            <Route path="products/:id" element={<ProductDetailsPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route
              path="checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="order-success/:id"
              element={
                <ProtectedRoute>
                  <OrderSuccessPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-orders"
              element={
                <ProtectedRoute>
                  <MyOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute>
                  <MyOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </ApolloProvider>
  );
};

export default App;
