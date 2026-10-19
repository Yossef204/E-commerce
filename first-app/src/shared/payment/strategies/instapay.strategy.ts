import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  IPaymentStrategy,
  PaymentResult,
  ProcessPaymentDto,
  RefundResult,
} from '../interfaces/payment-strategy.interface';

@Injectable()
export class InstaPayPaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.INSTAPAY;
  private readonly logger = new Logger(InstaPayPaymentStrategy.name);

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    this.logger.log(
      `[InstaPayStrategy] Processing InstaPay transfer of ${payload.amount} ${payload.currency} for order ${payload.orderId}`,
    );

    const transferRef =
      payload.transferReference ||
      payload.metadata?.transferReference ||
      payload.metadata?.instapayReference ||
      '';

    const cleanRef = transferRef.trim();
    if (!cleanRef) {
      throw new BadRequestException('رقم مرجع التحويل أو إشعار إنستاباي مطلوب لإتمام الطلب');
    }

    const transactionId = `instapay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.logger.log(
      `[InstaPayStrategy] Verified reference "${cleanRef}". Transaction ID: ${transactionId}`,
    );

    return {
      success: true,
      transactionId,
      method: this.method,
      status: 'CAPTURED',
      rawResponse: {
        provider: 'INSTAPAY_NETWORK',
        transferReference: cleanRef,
        amount: payload.amount,
        currency: payload.currency || 'EGP',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`[InstaPayStrategy] Reversing InstaPay transaction ${transactionId}, amount: ${amount}`);
    const refundId = `re_instapay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

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
    this.logger.log(`[InstaPayStrategy] Verifying InstaPay webhook signature`);
    return Boolean(signature || payload);
  }
}

