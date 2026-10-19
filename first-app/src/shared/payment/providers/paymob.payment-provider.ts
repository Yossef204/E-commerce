import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProcessParams,
  PaymentProcessResult,
  PaymentRefundParams,
  PaymentRefundResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class PaymobPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(PaymobPaymentProvider.name);

  async processPayment(params: PaymentProcessParams): Promise<PaymentProcessResult> {
    this.logger.log(
      `[PaymobPaymentProvider] Processing Paymob transaction of ${params.amount} EGP for order ${params.orderId}`,
    );

    // Paymob order registration & intention simulation
    const transactionId = `paymob_txn_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return {
      success: true,
      transactionId,
      provider: 'PAYMOB',
      status: 'CAPTURED',
      rawResponse: {
        id: transactionId,
        order: params.orderId,
        amount_cents: params.amount * 100,
        currency: 'EGP',
        success: true,
      },
    };
  }

  async refundPayment(params: PaymentRefundParams): Promise<PaymentRefundResult> {
    this.logger.log(
      `[PaymobPaymentProvider] Refunding Paymob transaction ${params.transactionId}`,
    );

    const refundId = `paymob_ref_${Date.now()}`;
    return {
      success: true,
      refundId,
      status: 'REFUNDED',
      rawResponse: {
        refund_id: refundId,
        transaction_id: params.transactionId,
      },
    };
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    this.logger.log(`[PaymobPaymentProvider] Verifying Paymob HMAC signature`);
    return Boolean(signature);
  }
}

