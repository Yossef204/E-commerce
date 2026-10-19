import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentMongoModule } from '../../shared/modules/payment.mongo.module';
import { EscrowMongoModule } from '../../shared/modules/escrow.mongo.module';
import { PayoutMongoModule } from '../../shared/modules/payout.mongo.module';
import { LedgerMongoModule } from '../../shared/modules/ledger.mongo.module';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { InventoryMongoModule } from '../../shared/modules/inventory.mongo.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentFactory } from './factory/payment.factory';

import { PaymentWebhookController } from './payment-webhook.controller';
import { SharedPaymentModule } from '../../shared/payment/shared-payment.module';

@Module({
  imports: [
    PaymentMongoModule,
    EscrowMongoModule,
    PayoutMongoModule,
    LedgerMongoModule,
    OrderMongoModule,
    SellingEntityMongoModule,
    UserMongoModule,
    InventoryMongoModule,
    SharedPaymentModule,
    JwtModule,
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService, PaymentFactory],
  exports: [PaymentService],
})
export class PaymentModule {}
