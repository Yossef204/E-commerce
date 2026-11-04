import { RolesEnum } from './roles';
import { Permission } from './permission.enum';

export * from './permission.enum';

export const PermissionEnum = {
  ...Permission,

  // Legacy Plural & Backward Compatibility Mappings
  PRODUCTS_CREATE: Permission.PRODUCT_CREATE,
  PRODUCTS_READ: Permission.PRODUCT_READ,
  PRODUCTS_READ_OWN: Permission.PRODUCT_READ,
  PRODUCTS_READ_ALL: Permission.PRODUCT_READ,
  PRODUCTS_UPDATE: Permission.PRODUCT_UPDATE,
  PRODUCTS_UPDATE_OWN: Permission.PRODUCT_UPDATE,
  PRODUCTS_DELETE: Permission.PRODUCT_DELETE,
  PRODUCTS_DELETE_OWN: Permission.PRODUCT_DELETE,
  PRODUCTS_APPROVE: Permission.PRODUCT_APPROVE,
  INVENTORY_MANAGE_OWN: Permission.INVENTORY_UPDATE,
  INVENTORY_MANAGE: Permission.INVENTORY_UPDATE,

  ORDERS_CREATE: Permission.ORDER_CREATE,
  ORDERS_READ: Permission.ORDER_READ,
  ORDERS_READ_OWN: Permission.ORDER_READ_OWN,
  ORDERS_SELLER_READ: Permission.ORDER_READ_ENTITY,
  ORDERS_STATUS_UPDATE: Permission.ORDER_UPDATE_STATUS,
  ORDERS_CANCEL_OWN: Permission.ORDER_CANCEL_OWN,

  REVIEWS_CREATE: Permission.REVIEW_CREATE,

  COUPONS_MANAGE_OWN: Permission.COUPON_MANAGE_OWN,
  COUPONS_MANAGE_GLOBAL: Permission.COUPON_MANAGE_GLOBAL,

  AUDIT_LOGS_READ: Permission.AUDIT_LOG_READ,
  COMMISSIONS_MANAGE: Permission.COMMISSION_MANAGE,

  COMPANY_PROFILE_UPDATE: Permission.SELLING_ENTITY_UPDATE_OWN,
  COMPANY_STAFF_INVITE: 'company.staff_invite',
  COMPANY_STAFF_MANAGE: 'company.staff_manage',
  ENTITY_MANAGE: Permission.SELLING_ENTITY_UPDATE_OWN,
  ENTITY_USERS_MANAGE: 'entity.users_manage',
  PROFILE_MANAGE: Permission.PROFILE_UPDATE_OWN,
} as const;

export type PermissionEnum = Permission;

/**
 * Valid canonical permissions set containing all registered Permission enum values
 */
export const VALID_PERMISSIONS_SET: ReadonlySet<string> = new Set<string>(
  Object.values(Permission),
);

/**
 * Translation dictionary for migrating legacy plural keys, aliases, and dropping broad/dangerous permissions
 */
export const LEGACY_PERMISSION_MAP: Readonly<Record<string, Permission | null>> = {
  // Broad / Dangerous keys to explicitly drop (mapped to null)
  'orders.read': null,
  'order.read': null,

  // Plural -> Singular Canonical Orders
  'orders.create': Permission.ORDER_CREATE,
  'orders.read_own': Permission.ORDER_READ_OWN,
  'orders.cancel_own': Permission.ORDER_CANCEL_OWN,
  'orders.seller_read': Permission.ORDER_READ_ENTITY,
  'orders.status_update': Permission.ORDER_UPDATE_STATUS,
  'order.cancel': Permission.ORDER_CANCEL_OWN,

  // Profile Mapping
  'profile.manage': Permission.PROFILE_UPDATE_OWN,
  'profile.read': Permission.PROFILE_READ_OWN,
  'profile.update': Permission.PROFILE_UPDATE_OWN,

  // Reviews
  'reviews.create': Permission.REVIEW_CREATE,
  'reviews.read': Permission.REVIEW_READ,

  // Products Plurals
  'products.create': Permission.PRODUCT_CREATE,
  'products.read': Permission.PRODUCT_READ,
  'products.read_own': Permission.PRODUCT_READ,
  'products.read_all': Permission.PRODUCT_READ,
  'products.update': Permission.PRODUCT_UPDATE,
  'products.update_own': Permission.PRODUCT_UPDATE,
  'products.delete': Permission.PRODUCT_DELETE,
  'products.delete_own': Permission.PRODUCT_DELETE,
  'products.approve': Permission.PRODUCT_APPROVE,
  'inventory.manage_own': Permission.INVENTORY_UPDATE,
  'inventory.manage': Permission.INVENTORY_UPDATE,

  // Coupons Plurals
  'coupons.manage_own': Permission.COUPON_MANAGE_OWN,
  'coupons.manage_global': Permission.COUPON_MANAGE_GLOBAL,

  // Other Legacy Plurals
  'audit_logs.read': Permission.AUDIT_LOG_READ,
  'commissions.manage': Permission.COMMISSION_MANAGE,
  'company.profile_update': Permission.SELLING_ENTITY_UPDATE_OWN,
  'entity.manage': Permission.SELLING_ENTITY_UPDATE_OWN,
  'returns.read': Permission.RETURN_READ_OWN,
};

/**
 * Canonical Customer-Scoped Role Permissions:
 * Contains only singular, canonical, deduplicated Permission enum values.
 * Strictly excludes orders.read, order.read, and profile.manage.
 */
export const DEFAULT_CUSTOMER_PERMISSIONS: Permission[] = [
  Permission.PRODUCT_READ,
  Permission.ORDER_CREATE,
  Permission.ORDER_READ_OWN,
  Permission.ORDER_CANCEL_OWN,
  Permission.REVIEW_CREATE,
  Permission.REVIEW_READ,
  Permission.PROFILE_READ_OWN,
  Permission.PROFILE_UPDATE_OWN,
  Permission.CART_MANAGE,
  Permission.COUPON_APPLY,
  Permission.RETURN_REQUEST,
  Permission.RETURN_READ_OWN,
  Permission.FILE_UPLOAD,
];

export const DEFAULT_SELLER_PERMISSIONS: Permission[] = [
  ...DEFAULT_CUSTOMER_PERMISSIONS,
  Permission.PRODUCT_CREATE,
  Permission.PRODUCT_UPDATE,
  Permission.PRODUCT_UPDATE_ENTITY,
  Permission.PRODUCT_DELETE,
  Permission.PRODUCT_DELETE_ENTITY,
  Permission.INVENTORY_UPDATE,
  Permission.INVENTORY_MANAGE_ENTITY,
  Permission.ORDER_READ_ENTITY,
  Permission.ORDER_UPDATE_STATUS,
  Permission.ORDER_UPDATE_ENTITY_STATUS,
  Permission.RETURN_READ_ENTITY,
  Permission.RETURN_INSPECT,
  Permission.SELLING_ENTITY_READ_OWN,
  Permission.SELLING_ENTITY_UPDATE_OWN,
  Permission.WALLET_READ_OWN,
  Permission.PAYOUT_READ_OWN,
  Permission.PAYOUT_READ_ENTITY,
  Permission.PAYOUT_REQUEST,
  Permission.COUPON_MANAGE_OWN,
  Permission.ANALYTICS_READ_OWN,
  Permission.BRAND_CREATE_OWN,
  Permission.BRAND_UPDATE_OWN,
  Permission.BRAND_DELETE_OWN,
];

export const DEFAULT_COMPANY_ADMIN_PERMISSIONS: Permission[] = [
  ...DEFAULT_SELLER_PERMISSIONS,
  Permission.SELLING_ENTITY_UPDATE_OWN,
  Permission.COMPANY_READ,
  Permission.COMPANY_UPDATE,
];

export const DEFAULT_SUPER_ADMIN_PERMISSIONS: Permission[] = Array.from(
  new Set(Object.values(Permission)),
);

export function getDefaultPermissionsForRole(
  role: RolesEnum | string,
): Permission[] {
  const normalizedRole = (role || '').toLowerCase();
  switch (normalizedRole) {
    case 'super_admin':
    case 'superadmin':
    case RolesEnum.SUPER_ADMIN.toLowerCase():
      return DEFAULT_SUPER_ADMIN_PERMISSIONS;
    case 'admin':
    case RolesEnum.ADMIN.toLowerCase():
      // Platform staff (موظف المنصة): Granular permissions from database
      return [];
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
