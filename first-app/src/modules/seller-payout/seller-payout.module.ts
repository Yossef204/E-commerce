import { Module } from '@nestjs/common';
import { SellerPayoutController } from './seller-payout.controller';
import { SellerPayoutService } from './seller-payout.service';
import { AdminReportController } from './admin-report.controller';
import { AdminPayoutService } from './admin-payout.service';
import { SellerPayoutMongoModule } from '../../shared/modules/seller-payout.mongo.module';
import { LedgerMongoModule } from '../../shared/modules/ledger.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { EscrowMongoModule } from '../../shared/modules/escrow.mongo.module';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { ReturnMongoModule } from '../../shared/modules/return.mongo.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    SellerPayoutMongoModule,
    LedgerMongoModule,
    SellingEntityMongoModule,
    EscrowMongoModule,
    OrderMongoModule,
    UserMongoModule,
    ReturnMongoModule,
    JwtModule,
  ],
  controllers: [SellerPayoutController, AdminReportController],
  providers: [SellerPayoutService, AdminPayoutService],
  exports: [SellerPayoutService, AdminPayoutService],
})
export class SellerPayoutModule {}

