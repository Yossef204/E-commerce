import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  IPaymentStrategy,
  PaymentResult,
  ProcessPaymentDto,
  RefundResult,
} from '../interfaces/payment-strategy.interface';

@Injectable()
export class CodPaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.COD;
  private readonly logger = new Logger(CodPaymentStrategy.name);

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    this.logger.log(
      `[CodStrategy] Initiating Cash on Delivery for order ${payload.orderId}, Amount: ${payload.amount} ${payload.currency}`,
    );

    const transactionId = `cod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      transactionId,
      method: this.method,
      status: 'PENDING',
      rawResponse: {
        paymentType: 'CASH_ON_DELIVERY',
        orderId: payload.orderId,
        amount: payload.amount,
        currency: payload.currency || 'EGP',
        collectOnDelivery: true,
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`[CodStrategy] Processing COD cancellation / refund for ${transactionId}, amount: ${amount}`);
    const refundId = `re_cod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

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
    return true;
  }
}

