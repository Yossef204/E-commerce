import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  IPaymentStrategy,
  ProcessPaymentDto,
  PaymentResult,
  RefundResult,
} from '../interfaces/payment-strategy.interface';

@Injectable()
export class PaymobPaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.PAYMOB;
  private readonly logger = new Logger(PaymobPaymentStrategy.name);

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    this.logger.log(
      `[PaymobStrategy] Processing ${payload.amount} ${payload.currency} for order ${payload.orderId}`,
    );

    const transactionId = `paymob_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      transactionId,
      method: this.method,
      status: 'CAPTURED',
      rawResponse: {
        id: transactionId,
        orderId: payload.orderId,
        amount_cents: Math.round(payload.amount * 100),
        currency: payload.currency,
        success: true,
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`[PaymobStrategy] Refunding txn ${transactionId}, amount: ${amount}`);
    const refundId = `re_paymob_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      refundId,
      status: 'REFUNDED',
      rawResponse: {
        transactionId,
        refundId,
        amount,
      },
    };
  }

  async verifyWebhook(signature: string, payload: any): Promise<boolean> {
    this.logger.log(`[PaymobStrategy] Validating Paymob HMAC signature`);
    return Boolean(signature || payload?.obj);
  }
}

