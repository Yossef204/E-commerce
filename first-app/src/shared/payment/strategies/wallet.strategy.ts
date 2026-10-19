import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  IPaymentStrategy,
  PaymentResult,
  ProcessPaymentDto,
  RefundResult,
} from '../interfaces/payment-strategy.interface';
import { VodafoneCashPaymentStrategy } from './vodafone-cash.strategy';
import { PaymobPaymentStrategy } from './paymob.strategy';
import { MockPaymentStrategy } from './mock.strategy';

@Injectable()
export class WalletPaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.WALLET;
  private readonly logger = new Logger(WalletPaymentStrategy.name);

  constructor(
    private readonly vodafoneCashProvider: VodafoneCashPaymentStrategy,
    private readonly paymobProvider: PaymobPaymentStrategy,
    private readonly mockProvider: MockPaymentStrategy,
  ) {}

  private getActiveProvider(): IPaymentStrategy {
    const configuredProvider = (
      process.env.WALLET_PAYMENT_PROVIDER || PaymentProvider.PAYMOB
    ).toUpperCase();

    switch (configuredProvider) {
      case PaymentProvider.PAYMOB:
        this.logger.log('[WalletStrategy] Routing wallet payment via Paymob');
        return this.paymobProvider;
      case PaymentProvider.MOCK:
        this.logger.log('[WalletStrategy] Routing wallet payment via Mock provider');
        return this.mockProvider;
      case PaymentProvider.INTERNAL:
      default:
        this.logger.log('[WalletStrategy] Routing wallet payment via internal mobile wallet provider');
        return this.vodafoneCashProvider;
    }
  }

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    const rawWallet = (payload.walletNumber || payload.metadata?.walletNumber || '').trim();
    if (!rawWallet) {
      throw new BadRequestException('رقم المحفظة الإلكترونية مطلوب لإتمام الدفع');
    }

    // Egyptian mobile wallet validation (11 digits, starts with 010, 011, 012, or 015)
    const egyptianWalletRegex = /^01[0125][0-9]{8}$/;
    if (!egyptianWalletRegex.test(rawWallet)) {
      throw new BadRequestException(
        'رقم المحفظة الإلكترونية غير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ (010، 011، 012، 015)',
      );
    }

    const provider = this.getActiveProvider();
    const result = await provider.processPayment(payload);

    return {
      ...result,
      method: PaymentMethod.WALLET,
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<RefundResult> {
    const provider = this.getActiveProvider();
    return provider.refundPayment(transactionId, amount);
  }

  async verifyWebhook(signature: string, payload: any): Promise<boolean> {
    const provider = this.getActiveProvider();
    return provider.verifyWebhook(signature, payload);
  }
}

