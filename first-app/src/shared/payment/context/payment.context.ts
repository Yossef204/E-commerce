import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../enums/payment-method.enum';
import { IPaymentStrategy } from '../interfaces/payment-strategy.interface';
import { CardPaymentStrategy } from '../strategies/card.strategy';
import { WalletPaymentStrategy } from '../strategies/wallet.strategy';
import { InstaPayPaymentStrategy } from '../strategies/instapay.strategy';
import { CodPaymentStrategy } from '../strategies/cod.strategy';
import { StripePaymentStrategy } from '../strategies/stripe.strategy';
import { PaymobPaymentStrategy } from '../strategies/paymob.strategy';
import { VodafoneCashPaymentStrategy } from '../strategies/vodafone-cash.strategy';
import { MockPaymentStrategy } from '../strategies/mock.strategy';

export interface PaymentMethodOption {
  code: string;
  name: string;
  description: string;
  requiresFields: string[];
  icon: string;
}

@Injectable()
export class PaymentContext {
  private readonly logger = new Logger(PaymentContext.name);
  private readonly strategies = new Map<string, IPaymentStrategy>();

  constructor(
    private readonly cardStrategy: CardPaymentStrategy,
    private readonly walletStrategy: WalletPaymentStrategy,
    private readonly instapayStrategy: InstaPayPaymentStrategy,
    private readonly codStrategy: CodPaymentStrategy,
    private readonly stripeStrategy: StripePaymentStrategy,
    private readonly paymobStrategy: PaymobPaymentStrategy,
    private readonly vodafoneCashStrategy: VodafoneCashPaymentStrategy,
    private readonly mockStrategy: MockPaymentStrategy,
  ) {
    // Primary Client-Facing Payment Methods
    this.strategies.set(PaymentMethod.CARD, this.cardStrategy);
    this.strategies.set(PaymentMethod.WALLET, this.walletStrategy);
    this.strategies.set(PaymentMethod.INSTAPAY, this.instapayStrategy);
    this.strategies.set(PaymentMethod.COD, this.codStrategy);

    // Compatibility and Legacy Gateway Aliases
    this.strategies.set('CASH_ON_DELIVERY', this.codStrategy);
    this.strategies.set('STRIPE', this.cardStrategy);
    this.strategies.set('PAYMOB', this.cardStrategy);
    this.strategies.set('CREDIT_CARD', this.cardStrategy);
    this.strategies.set('DEBIT_CARD', this.cardStrategy);
    this.strategies.set('VODAFONE_CASH', this.walletStrategy);
    this.strategies.set('ORANGE_CASH', this.walletStrategy);
    this.strategies.set('ETISALAT_CASH', this.walletStrategy);
    this.strategies.set('WE_PAY', this.walletStrategy);
    this.strategies.set(PaymentMethod.MOCK, this.mockStrategy);
  }

  getStrategy(method: PaymentMethod | string): IPaymentStrategy {
    const raw = (method || '').trim().toUpperCase();
    let normalized = raw;

    if (raw === 'CASH_ON_DELIVERY' || raw === 'COD') {
      normalized = PaymentMethod.COD;
    } else if (
      raw === 'CARD' ||
      raw === 'STRIPE' ||
      raw === 'PAYMOB' ||
      raw === 'CREDIT_CARD' ||
      raw === 'DEBIT_CARD'
    ) {
      normalized = PaymentMethod.CARD;
    } else if (
      raw === 'WALLET' ||
      raw === 'VODAFONE_CASH' ||
      raw === 'ORANGE_CASH' ||
      raw === 'ETISALAT_CASH' ||
      raw === 'WE_PAY'
    ) {
      normalized = PaymentMethod.WALLET;
    } else if (raw === 'INSTAPAY' || raw === 'IPN') {
      normalized = PaymentMethod.INSTAPAY;
    }

    const strategy = this.strategies.get(normalized) || this.strategies.get(raw);
    if (!strategy) {
      if (this.strategies.has(PaymentMethod.MOCK)) {
        this.logger.warn(`Strategy for "${method}" not found. Falling back to MOCK.`);
        return this.strategies.get(PaymentMethod.MOCK)!;
      }
      throw new BadRequestException(`طريقة الدفع المحددة غير مدعومة: ${method}`);
    }
    return strategy;
  }

  /**
   * Returns clean, user-friendly payment methods without technical provider names
   */
  getAvailablePaymentMethods(): PaymentMethodOption[] {
    return [
      {
        code: PaymentMethod.CARD,
        name: 'بطاقة بنكية (فيزا / ماستركارد / ميزة)',
        description: 'دفع إلكتروني فوري وآمن بجميع البطاقات البنكية المصرية والدولية',
        requiresFields: ['cardNumber', 'cardExpiry', 'cardCvc', 'cardHolder'],
        icon: 'credit-card',
      },
      {
        code: PaymentMethod.WALLET,
        name: 'محفظة إلكترونية (فودافون كاش، أورنج، اتصالات، وي)',
        description: 'سداد فوري عبر أي محفظة هاتف ذكي في جمهورية مصر العربية',
        requiresFields: ['walletNumber'],
        icon: 'smartphone',
      },
      {
        code: PaymentMethod.INSTAPAY,
        name: 'إنستاباي (InstaPay)',
        description: 'تحويل بنكي لحظي مباشر عبر شبكة المدفوعات اللحظية IPN وعنوان الدفع (IPA)',
        requiresFields: ['transferReference'],
        icon: 'zap',
      },
      {
        code: PaymentMethod.COD,
        name: 'الدفع عند الاستلام (Cash on Delivery)',
        description: 'سداد قيمة المشتريات نقداً لمندوب الشحن عند استلام الطلب',
        requiresFields: [],
        icon: 'truck',
      },
    ];
  }
}
