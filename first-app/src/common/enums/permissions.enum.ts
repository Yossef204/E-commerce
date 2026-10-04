import { RolesEnum } from './roles';

export enum PermissionEnum {
  // Customer Permissions
  PROFILE_READ = 'profile.read',
  PROFILE_UPDATE = 'profile.update',
  CART_MANAGE = 'cart.manage',
  ORDERS_CREATE = 'orders.create',
  ORDERS_READ_OWN = 'orders.read_own',
  ORDERS_CANCEL_OWN = 'orders.cancel_own',
  REVIEWS_CREATE = 'reviews.create',

  // Customer Aliases & Backward Compatibility
  ORDERS_READ = 'orders.read',
  PROFILE_MANAGE = 'profile.manage',

  // Seller Permissions
  PRODUCTS_CREATE = 'products.create',
  PRODUCTS_READ_OWN = 'products.read_own',
  PRODUCTS_UPDATE_OWN = 'products.update_own',
  PRODUCTS_DELETE_OWN = 'products.delete_own',
  INVENTORY_MANAGE_OWN = 'inventory.manage_own',
  ORDERS_SELLER_READ = 'orders.seller_read',
  ORDERS_STATUS_UPDATE = 'orders.status_update',
  COUPONS_MANAGE_OWN = 'coupons.manage_own',
  ANALYTICS_READ_OWN = 'analytics.read_own',
  PAYOUT_REQUEST = 'payout.request',

  // Seller Aliases & Backward Compatibility
  PRODUCTS_READ = 'products.read',
  PRODUCTS_UPDATE = 'products.update',
  PRODUCTS_DELETE = 'products.delete',
  INVENTORY_MANAGE = 'inventory.manage',

  // Company Admin Permissions
  COMPANY_STAFF_INVITE = 'company.staff_invite',
  COMPANY_STAFF_MANAGE = 'company.staff_manage',
  COMPANY_PROFILE_UPDATE = 'company.profile_update',
  BRAND_MANAGE = 'brand.manage',

  // Company Admin Aliases & Backward Compatibility
  ENTITY_MANAGE = 'entity.manage',
  ENTITY_USERS_MANAGE = 'entity.users_manage',
  ANALYTICS_READ = 'analytics.read',

  // Super Admin Permissions
  PLATFORM_SUPER_ADMIN = 'platform.super_admin',
  SELLING_ENTITY_APPROVE = 'selling_entity.approve',
  SELLING_ENTITY_READ = 'selling_entity.read',
  SELLING_ENTITY_SUSPEND = 'selling_entity.suspend',
  PRODUCTS_APPROVE = 'products.approve',
  PRODUCTS_READ_ALL = 'products.read_all',
  COMMISSIONS_MANAGE = 'commissions.manage',
  ESCROW_MANAGE = 'escrow.manage',
  PAYOUT_PROCESS = 'payout.process',
  COUPONS_MANAGE_GLOBAL = 'coupons.manage_global',
  AUDIT_LOGS_READ = 'audit_logs.read',
}

export const DEFAULT_CUSTOMER_PERMISSIONS: PermissionEnum[] = [
  PermissionEnum.PROFILE_READ,
  PermissionEnum.PROFILE_UPDATE,
  PermissionEnum.CART_MANAGE,
  PermissionEnum.ORDERS_CREATE,
  PermissionEnum.ORDERS_READ_OWN,
  PermissionEnum.ORDERS_CANCEL_OWN,
  PermissionEnum.REVIEWS_CREATE,
  PermissionEnum.ORDERS_READ,
  PermissionEnum.PROFILE_MANAGE,
];

export const DEFAULT_SELLER_PERMISSIONS: PermissionEnum[] = [
  ...DEFAULT_CUSTOMER_PERMISSIONS,
  PermissionEnum.PRODUCTS_CREATE,
  PermissionEnum.PRODUCTS_READ_OWN,
  PermissionEnum.PRODUCTS_UPDATE_OWN,
  PermissionEnum.PRODUCTS_DELETE_OWN,
  PermissionEnum.INVENTORY_MANAGE_OWN,
  PermissionEnum.ORDERS_SELLER_READ,
  PermissionEnum.ORDERS_STATUS_UPDATE,
  PermissionEnum.COUPONS_MANAGE_OWN,
  PermissionEnum.ANALYTICS_READ_OWN,
  PermissionEnum.PAYOUT_REQUEST,
  PermissionEnum.PRODUCTS_READ,
  PermissionEnum.PRODUCTS_UPDATE,
  PermissionEnum.PRODUCTS_DELETE,
  PermissionEnum.INVENTORY_MANAGE,
];

export const DEFAULT_COMPANY_ADMIN_PERMISSIONS: PermissionEnum[] = [
  ...DEFAULT_SELLER_PERMISSIONS,
  PermissionEnum.COMPANY_STAFF_INVITE,
  PermissionEnum.COMPANY_STAFF_MANAGE,
  PermissionEnum.COMPANY_PROFILE_UPDATE,
  PermissionEnum.BRAND_MANAGE,
  PermissionEnum.ENTITY_MANAGE,
  PermissionEnum.ENTITY_USERS_MANAGE,
  PermissionEnum.ANALYTICS_READ,
];

export const DEFAULT_SUPER_ADMIN_PERMISSIONS: PermissionEnum[] =
  Object.values(PermissionEnum);

export function getDefaultPermissionsForRole(
  role: RolesEnum | string,
): PermissionEnum[] {
  const normalizedRole = (role || '').toLowerCase();
  switch (normalizedRole) {
    case RolesEnum.SUPER_ADMIN.toLowerCase():
    case 'admin':
    case 'super_admin':
      return DEFAULT_SUPER_ADMIN_PERMISSIONS;
    case RolesEnum.COMPANY_ADMIN.toLowerCase():
    case 'company_admin':
      return DEFAULT_COMPANY_ADMIN_PERMISSIONS;
    case RolesEnum.SELLER.toLowerCase():
    case 'seller':
      return DEFAULT_SELLER_PERMISSIONS;
    case RolesEnum.CUSTOMER.toLowerCase():
    case RolesEnum.user.toLowerCase():
    case 'customer':
    case 'user':
    default:
      return DEFAULT_CUSTOMER_PERMISSIONS;
  }
}
