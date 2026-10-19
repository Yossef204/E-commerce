export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER_TOKEN';

export interface PaymentProcessParams {
  amount: number;
  currency: string;
  paymentMethod: string;
  customerId: string;
  orderId: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface PaymentProcessResult {
  success: boolean;
  transactionId: string;
  provider: string;
  status: 'CAPTURED' | 'FAILED' | 'PENDING';
  rawResponse?: any;
  errorMessage?: string;
}

export interface PaymentRefundParams {
  transactionId: string;
  amount?: number;
  reason?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  refundId: string;
  status: 'REFUNDED' | 'FAILED';
  rawResponse?: any;
  errorMessage?: string;
}

export interface IPaymentProvider {
  processPayment(params: PaymentProcessParams): Promise<PaymentProcessResult>;
  refundPayment(params: PaymentRefundParams): Promise<PaymentRefundResult>;
  verifyWebhook(payload: any, signature: string): Promise<boolean>;
}

