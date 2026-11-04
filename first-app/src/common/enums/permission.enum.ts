export enum Permission {
  // Profiles & Identity (Own Resource & Management)
  PROFILE_READ_OWN = 'profile.read_own',
  PROFILE_UPDATE_OWN = 'profile.update_own',
  PROFILE_READ = 'profile.read',
  PROFILE_UPDATE = 'profile.update',
  USER_MANAGE = 'user.manage',

  // Cart
  CART_MANAGE = 'cart.manage',

  // Products & Inventory
  PRODUCT_READ = 'product.read',
  PRODUCT_CREATE = 'product.create',
  PRODUCT_UPDATE = 'product.update',
  PRODUCT_UPDATE_ENTITY = 'product.update_entity',
  PRODUCT_DELETE = 'product.delete',
  PRODUCT_DELETE_ENTITY = 'product.delete_entity',
  PRODUCT_APPROVE = 'product.approve',
  INVENTORY_UPDATE = 'inventory.update',
  INVENTORY_MANAGE_ENTITY = 'inventory.manage_entity',

  // Orders & Fulfillment (Scope: own, entity, all)
  ORDER_CREATE = 'order.create',
  ORDER_READ_OWN = 'order.read_own',
  ORDER_READ_ENTITY = 'order.read_entity',
  ORDER_READ_ALL = 'order.read_all',
  ORDER_READ = 'order.read',
  ORDER_UPDATE_STATUS = 'order.update_status',
  ORDER_UPDATE_ENTITY_STATUS = 'order.update_entity_status',
  ORDER_CANCEL_OWN = 'order.cancel_own',
  ORDER_CANCEL = 'order.cancel',

  // Returns & Refunds
  RETURN_REQUEST = 'return.request',
  RETURN_READ_OWN = 'return.read_own',
  RETURN_READ_ENTITY = 'return.read_entity',
  RETURN_READ = 'return.read',
  RETURN_INSPECT = 'return.inspect',
  REFUND_APPROVE = 'refund.approve',
  REFUND_EXECUTE = 'refund.execute',

  // Selling Entities & Company
  SELLING_ENTITY_READ_OWN = 'selling_entity.read_own',
  SELLING_ENTITY_UPDATE_OWN = 'selling_entity.update_own',
  SELLING_ENTITY_READ_ALL = 'selling_entity.read_all',
  SELLING_ENTITY_READ = 'selling_entity.read',
  SELLING_ENTITY_APPROVE = 'selling_entity.approve',
  SELLING_ENTITY_SUSPEND = 'selling_entity.suspend',
  COMPANY_READ = 'company.read',
  COMPANY_UPDATE = 'company.update',
  COMPANY_APPROVE = 'company.approve',
  SELLER_MANAGE = 'seller.manage',

  // Finance, Wallet, Escrow, Ledger & Payouts
  WALLET_READ_OWN = 'wallet.read_own',
  LEDGER_READ = 'ledger.read',
  PAYOUT_READ_OWN = 'payout.read_own',
  PAYOUT_READ_ENTITY = 'payout.read_entity',
  PAYOUT_READ_ALL = 'payout.read_all',
  PAYOUT_READ = 'payout.read',
  PAYOUT_REQUEST = 'payout.request',
  PAYOUT_PROCESS = 'payout.process',
  PAYOUT_APPROVE = 'payout.approve',
  COMMISSION_MANAGE = 'commission.manage',
  ESCROW_MANAGE = 'escrow.manage',

  // Coupons
  COUPON_MANAGE_OWN = 'coupon.manage_own',
  COUPON_MANAGE_GLOBAL = 'coupon.manage_global',
  COUPON_APPLY = 'coupon.apply',

  // Reviews
  REVIEW_CREATE = 'review.create',
  REVIEW_READ = 'review.read',
  REVIEW_MODERATE = 'review.moderate',

  // Analytics
  ANALYTICS_READ_OWN = 'analytics.read_own',
  ANALYTICS_READ_ALL = 'analytics.read_all',
  ANALYTICS_READ = 'analytics.read',

  // Administration & Platform Infrastructure
  CATEGORY_MANAGE = 'category.manage',
  BRAND_MANAGE = 'brand.manage',
  BRAND_MANAGE_ALL = 'brand.manage.all',
  BRAND_CREATE_OWN = 'brand.create.own',
  BRAND_UPDATE_OWN = 'brand.update.own',
  BRAND_DELETE_OWN = 'brand.delete.own',
  SETTINGS_MANAGE = 'settings.manage',
  AUDIT_LOG_READ = 'audit_log.read',
  FILE_UPLOAD = 'file.upload',
  PLATFORM_SUPER_ADMIN = 'platform.super_admin',
}
