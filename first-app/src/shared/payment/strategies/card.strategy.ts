import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  IPaymentStrategy,
  PaymentResult,
  ProcessPaymentDto,
  RefundResult,
} from '../interfaces/payment-strategy.interface';
import { PaymobPaymentStrategy } from './paymob.strategy';
import { StripePaymentStrategy } from './stripe.strategy';
import { MockPaymentStrategy } from './mock.strategy';

@Injectable()
export class CardPaymentStrategy implements IPaymentStrategy {
  readonly method = PaymentMethod.CARD;
  private readonly logger = new Logger(CardPaymentStrategy.name);

  constructor(
    private readonly paymobProvider: PaymobPaymentStrategy,
    private readonly stripeProvider: StripePaymentStrategy,
    private readonly mockProvider: MockPaymentStrategy,
  ) {}

  /**
   * Determine the underlying payment provider dynamically via ENV configuration.
   * Defaults to PAYMOB for Egyptian market, or STRIPE / MOCK based on configuration.
   */
  private getActiveProvider(): IPaymentStrategy {
    const configuredProvider = (
      process.env.CARD_PAYMENT_PROVIDER || PaymentProvider.PAYMOB
    ).toUpperCase();

    switch (configuredProvider) {
      case PaymentProvider.STRIPE:
        this.logger.log('[CardStrategy] Routing transaction through Stripe provider');
        return this.stripeProvider;
      case PaymentProvider.MOCK:
        this.logger.log('[CardStrategy] Routing transaction through Mock provider');
        return this.mockProvider;
      case PaymentProvider.PAYMOB:
      default:
        this.logger.log('[CardStrategy] Routing transaction through Paymob provider');
        return this.paymobProvider;
    }
  }

  async processPayment(payload: ProcessPaymentDto): Promise<PaymentResult> {
    const provider = this.getActiveProvider();
    const result = await provider.processPayment(payload);

    return {
      ...result,
      method: PaymentMethod.CARD,
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

