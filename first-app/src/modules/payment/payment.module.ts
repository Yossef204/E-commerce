import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentMongoModule } from '../../shared/modules/payment.mongo.module';
import { EscrowMongoModule } from '../../shared/modules/escrow.mongo.module';
import { PayoutMongoModule } from '../../shared/modules/payout.mongo.module';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { InventoryMongoModule } from '../../shared/modules/inventory.mongo.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentFactory } from './factory/payment.factory';

@Module({
  imports: [
    PaymentMongoModule,
    EscrowMongoModule,
    PayoutMongoModule,
    OrderMongoModule,
    SellingEntityMongoModule,
    UserMongoModule,
    InventoryMongoModule,
    JwtModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentFactory],
  exports: [PaymentService],
})
export class PaymentModule {}
