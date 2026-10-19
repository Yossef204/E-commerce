import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  IPaymentStrategy,
  ProcessPaymentDto,
  PaymentResult,
  RefundResult,
} from '../interfaces/payment-strategy.interface';

@Injectable()
export class MockPaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.MOCK;
  private readonly logger = new Logger(MockPaymentStrategy.name);

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    this.logger.log(
      `[MockStrategy] Processing simulated payment of ${payload.amount} ${payload.currency} for order ${payload.orderId}`,
    );

    const transactionId = `mock_txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      transactionId,
      method: this.method,
      status: 'CAPTURED',
      rawResponse: {
        transactionId,
        orderId: payload.orderId,
        amount: payload.amount,
        simulated: true,
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`[MockStrategy] Simulating refund for txn ${transactionId}, amount: ${amount}`);
    const refundId = `mock_ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      refundId,
      status: 'REFUNDED',
      rawResponse: {
        transactionId,
        refundId,
        amount,
        simulated: true,
      },
    };
  }

  async verifyWebhook(signature: string, payload: any): Promise<boolean> {
    this.logger.log(`[MockStrategy] Simulating webhook verification`);
    return true;
  }
}

