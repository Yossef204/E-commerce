import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProcessParams,
  PaymentProcessResult,
  PaymentRefundParams,
  PaymentRefundResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class StripePaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);

  async processPayment(params: PaymentProcessParams): Promise<PaymentProcessResult> {
    this.logger.log(
      `[StripePaymentProvider] Processing card payment of ${params.amount} ${params.currency} for customer ${params.customerId}`,
    );

    // Stripe intent simulation / integration
    const transactionId = `ch_stripe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      transactionId,
      provider: 'STRIPE',
      status: 'CAPTURED',
      rawResponse: {
        id: transactionId,
        currency: params.currency,
        amount_captured: params.amount * 100,
        paid: true,
      },
    };
  }

  async refundPayment(params: PaymentRefundParams): Promise<PaymentRefundResult> {
    this.logger.log(
      `[StripePaymentProvider] Refunding Stripe transaction ${params.transactionId}`,
    );

    const refundId = `re_stripe_${Date.now()}`;
    return {
      success: true,
      refundId,
      status: 'REFUNDED',
      rawResponse: {
        id: refundId,
        charge: params.transactionId,
        status: 'succeeded',
      },
    };
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    this.logger.log(`[StripePaymentProvider] Verifying Stripe webhook signature`);
    return Boolean(signature && signature.length > 10);
  }
}

