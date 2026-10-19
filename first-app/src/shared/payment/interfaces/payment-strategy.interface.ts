import { PaymentMethod } from '../enums/payment-method.enum';

export interface ProcessPaymentDto {
  amount: number;
  currency: string;
  customerId: string;
  orderId: string;
  idempotencyKey?: string;
  walletNumber?: string;
  transferReference?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  method: PaymentMethod;
  status: 'CAPTURED' | 'FAILED' | 'PENDING';
  rawResponse?: any;
  errorMessage?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  status: 'REFUNDED' | 'FAILED';
  rawResponse?: any;
  errorMessage?: string;
}

export interface IPaymentStrategy {
  readonly method: PaymentMethod;
  processPayment(payload: ProcessPaymentDto): Promise<PaymentResult>;
  refundPayment(transactionId: string, amount: number): Promise<RefundResult>;
  verifyWebhook(signature: string, payload: any): Promise<boolean>;
}

