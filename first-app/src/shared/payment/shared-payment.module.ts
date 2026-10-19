import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Inventory, InventorySchema } from '../../models/inventory/inventory.schema';
import { MainOrder, MainOrderSchema } from '../../models/order/main-order.schema';
import { Payment, PaymentSchema } from '../../models/payment/payment.schema';
import { StripePaymentStrategy } from './strategies/stripe.strategy';
import { PaymobPaymentStrategy } from './strategies/paymob.strategy';
import { VodafoneCashPaymentStrategy } from './strategies/vodafone-cash.strategy';
import { MockPaymentStrategy } from './strategies/mock.strategy';
import { CardPaymentStrategy } from './strategies/card.strategy';
import { WalletPaymentStrategy } from './strategies/wallet.strategy';
import { InstaPayPaymentStrategy } from './strategies/instapay.strategy';
import { CodPaymentStrategy } from './strategies/cod.strategy';
import { PaymentContext } from './context/payment.context';
import { IdempotencyService } from './services/idempotency.service';
import { CheckoutSagaService } from './saga/checkout.saga';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: MainOrder.name, schema: MainOrderSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  providers: [
    StripePaymentStrategy,
    PaymobPaymentStrategy,
    VodafoneCashPaymentStrategy,
    MockPaymentStrategy,
    CardPaymentStrategy,
    WalletPaymentStrategy,
    InstaPayPaymentStrategy,
    CodPaymentStrategy,
    PaymentContext,
    IdempotencyService,
    CheckoutSagaService,
  ],
  exports: [
    PaymentContext,
    CheckoutSagaService,
    IdempotencyService,
    CardPaymentStrategy,
    WalletPaymentStrategy,
    InstaPayPaymentStrategy,
    CodPaymentStrategy,
    StripePaymentStrategy,
    PaymobPaymentStrategy,
    VodafoneCashPaymentStrategy,
    MockPaymentStrategy,
  ],
})
export class SharedPaymentModule {}
