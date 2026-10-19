import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReturnMongoModule } from '../../shared/modules/return.mongo.module';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { InventoryMongoModule } from '../../shared/modules/inventory.mongo.module';
import { LedgerMongoModule } from '../../shared/modules/ledger.mongo.module';
import { PaymentMongoModule } from '../../shared/modules/payment.mongo.module';
import { ReturnService } from './return.service';
import { ReturnController } from './return.controller';

@Module({
  imports: [
    ReturnMongoModule,
    OrderMongoModule,
    SellingEntityMongoModule,
    InventoryMongoModule,
    LedgerMongoModule,
    PaymentMongoModule,
    JwtModule,
  ],
  controllers: [ReturnController],
  providers: [ReturnService],
  exports: [ReturnService],
})
export class ReturnModule {}

