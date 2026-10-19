export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED_PENDING_SHIPMENT'
  | 'INSPECTED'
  | 'REFUNDED'
  | 'REJECTED';

export type InspectionResult = 'RESALABLE' | 'SCRAP_DAMAGED';

export type ReturnReason =
  | 'DEFECTIVE'
  | 'NOT_AS_DESCRIBED'
  | 'WRONG_ITEM'
  | 'CHANGED_MIND'
  | string;

export type RefundMethod = 'ORIGINAL_PAYMENT' | 'WALLET_CREDIT';

export interface ReturnRequestItem {
  productId?: string;
  sku: string;
  variantId?: string;
  quantity: number;
  price?: number;
  reason: ReturnReason;
  conditionNote?: string;
}

export interface ReturnRequestCustomer {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface ReturnRequestOrder {
  _id: string;
  orderNumber?: string;
  totalAmount?: number;
  status?: string;
  createdAt?: string;
}

export interface ReturnRequestSellingEntity {
  _id: string;
  tradeName?: string;
  legalName?: string;
}

export interface ReturnRequest {
  _id: string;
  orderId: string | ReturnRequestOrder;
  entityOrderId: string;
  customerId: string | ReturnRequestCustomer;
  sellingEntityId: string | ReturnRequestSellingEntity;
  items: ReturnRequestItem[];
  status: ReturnStatus;
  customerReason?: string;
  proofImages?: string[];
  refundMethod?: RefundMethod;
  refundAmount?: number;
  inspectionResult?: InspectionResult;
  vendorNote?: string;
  rejectionReason?: string;
  inspectedAt?: string;
  inspectedBy?: string;
  refundedAt?: string;
  refundTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReturnRequestPayload {
  orderId: string;
  entityOrderId: string;
  items: {
    productId: string;
    sku: string;
    quantity: number;
    price: number;
    reason: string;
  }[];
  customerReason?: string;
  proofImages?: string[];
  refundMethod?: RefundMethod;
}

export interface InspectReturnPayload {
  status: ReturnStatus;
  inspectionResult?: InspectionResult;
  vendorNote?: string;
  rejectionReason?: string;
}

export interface VendorReturnsListResponse {
  returns: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

