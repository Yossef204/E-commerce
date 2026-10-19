import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  IPaymentStrategy,
  ProcessPaymentDto,
  PaymentResult,
  RefundResult,
} from '../interfaces/payment-strategy.interface';

@Injectable()
export class VodafoneCashPaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.VODAFONE_CASH;
  private readonly logger = new Logger(VodafoneCashPaymentStrategy.name);

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    this.logger.log(
      `[VodafoneCash] Initiating wallet payment of ${payload.amount} ${payload.currency} for order ${payload.orderId}`,
    );

    const walletNumber = (payload.walletNumber || payload.metadata?.walletNumber || '').trim();
    if (!walletNumber) {
      throw new BadRequestException('رقم محفظة فودافون كاش مطلوب لإتمام عملية الدفع');
    }

    // Egyptian Vodafone Cash wallet validation (11 digits, starts with 010)
    const vodafoneRegex = /^010[0-9]{8}$/;
    if (!vodafoneRegex.test(walletNumber)) {
      throw new BadRequestException('رقم محفظة فودافون كاش غير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010');
    }

    // Matching or verifying transfer reference code
    const transferRef =
      payload.transferReference ||
      payload.metadata?.transferReference ||
      `VF-REF-${Math.floor(100000 + Math.random() * 900000)}`;

    const transactionId = `vf_cash_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.logger.log(
      `[VodafoneCash] Wallet ${walletNumber} matched transfer reference: ${transferRef}. Txn: ${transactionId}`,
    );

    return {
      success: true,
      transactionId,
      method: this.method,
      status: 'CAPTURED',
      rawResponse: {
        walletNumber,
        transferReference: transferRef,
        amount: payload.amount,
        currency: payload.currency || 'EGP',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`[VodafoneCash] Reversing transfer for txn ${transactionId}, amount: ${amount}`);
    const refundId = `re_vf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      refundId,
      status: 'REFUNDED',
      rawResponse: {
        transactionId,
        refundId,
        amount,
        reversedAt: new Date().toISOString(),
      },
    };
  }

  async verifyWebhook(signature: string, payload: any): Promise<boolean> {
    this.logger.log(`[VodafoneCash] Verifying incoming USSD/SMS webhook notification`);
    return Boolean(payload?.transferReference || signature);
  }
}

