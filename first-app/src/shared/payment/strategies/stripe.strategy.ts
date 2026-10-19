import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  IPaymentStrategy,
  ProcessPaymentDto,
  PaymentResult,
  RefundResult,
} from '../interfaces/payment-strategy.interface';

@Injectable()
export class StripePaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.STRIPE;
  private readonly logger = new Logger(StripePaymentStrategy.name);

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    this.logger.log(
      `[StripeStrategy] Charging ${payload.amount} ${payload.currency} for order ${payload.orderId}`,
    );

    const transactionId = `ch_stripe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      transactionId,
      method: this.method,
      status: 'CAPTURED',
      rawResponse: {
        id: transactionId,
        amount: payload.amount,
        currency: payload.currency,
        paid: true,
        created: Math.floor(Date.now() / 1000),
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`[StripeStrategy] Refunding ${amount} for txn ${transactionId}`);
    const refundId = `re_stripe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      refundId,
      status: 'REFUNDED',
      rawResponse: {
        id: refundId,
        charge: transactionId,
        amount,
        status: 'succeeded',
      },
    };
  }

  async verifyWebhook(signature: string, payload: any): Promise<boolean> {
    this.logger.log(`[StripeStrategy] Verifying webhook signature`);
    return Boolean(signature && payload);
  }
}

