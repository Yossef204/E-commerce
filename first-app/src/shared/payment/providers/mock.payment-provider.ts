import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProcessParams,
  PaymentProcessResult,
  PaymentRefundParams,
  PaymentRefundResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async processPayment(params: PaymentProcessParams): Promise<PaymentProcessResult> {
    this.logger.log(
      `[MockPaymentProvider] Processing payment of ${params.amount} ${params.currency} for order ${params.orderId}`,
    );

    // Simulate payment transaction
    const transactionId = `MOCK-TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      success: true,
      transactionId,
      provider: 'MOCK',
      status: 'CAPTURED',
      rawResponse: {
        timestamp: new Date().toISOString(),
        orderId: params.orderId,
        amount: params.amount,
        simulated: true,
      },
    };
  }

  async refundPayment(params: PaymentRefundParams): Promise<PaymentRefundResult> {
    this.logger.log(
      `[MockPaymentProvider] Refunding transaction ${params.transactionId} amount: ${params.amount ?? 'full'}`,
    );

    const refundId = `MOCK-REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      success: true,
      refundId,
      status: 'REFUNDED',
      rawResponse: {
        transactionId: params.transactionId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    this.logger.log(`[MockPaymentProvider] Verifying webhook signature: ${signature}`);
    return true;
  }
}

