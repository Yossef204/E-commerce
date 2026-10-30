export const Permission = {
  // Products & Inventory
  PRODUCT_READ: 'product.read',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  PRODUCT_APPROVE: 'product.approve',
  INVENTORY_UPDATE: 'inventory.update',

  // Orders & Fulfillment
  ORDER_READ: 'order.read',
  ORDER_UPDATE_STATUS: 'order.update_status',
  ORDER_CANCEL: 'order.cancel',

  // Returns & Refunds
  RETURN_READ: 'return.read',
  RETURN_INSPECT: 'return.inspect',
  REFUND_APPROVE: 'refund.approve',
  REFUND_EXECUTE: 'refund.execute',

  // Company & Sellers Management
  COMPANY_READ: 'company.read',
  COMPANY_UPDATE: 'company.update',
  COMPANY_APPROVE: 'company.approve',
  SELLER_MANAGE: 'seller.manage',

  // Finance, Escrow & Ledger
  LEDGER_READ: 'ledger.read',
  PAYOUT_READ: 'payout.read',
  PAYOUT_REQUEST: 'payout.request',
  PAYOUT_APPROVE: 'payout.approve',
  COMMISSION_MANAGE: 'commission.manage',

  // Platform Administration & Security
  USER_MANAGE: 'user.manage',
  CATEGORY_MANAGE: 'category.manage',
  SETTINGS_MANAGE: 'settings.manage',
  REVIEW_MODERATE: 'review.moderate',
  AUDIT_LOG_READ: 'audit_log.read',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
