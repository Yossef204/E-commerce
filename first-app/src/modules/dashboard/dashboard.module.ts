import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CompanyDashboardController } from './company-dashboard.controller';
import { CompanyDashboardService } from './company-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { InventoryMongoModule } from '../../shared/modules/inventory.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { LedgerMongoModule } from '../../shared/modules/ledger.mongo.module';
import { EscrowMongoModule } from '../../shared/modules/escrow.mongo.module';
import { PayoutMongoModule } from '../../shared/modules/payout.mongo.module';
import { SellerPayoutMongoModule } from '../../shared/modules/seller-payout.mongo.module';
import { PaymentMongoModule } from '../../shared/modules/payment.mongo.module';
import { ReturnMongoModule } from '../../shared/modules/return.mongo.module';

@Module({
  imports: [
    JwtModule,
    OrderMongoModule,
    ProductMongoModule,
    InventoryMongoModule,
    SellingEntityMongoModule,
    UserMongoModule,
    LedgerMongoModule,
    EscrowMongoModule,
    PayoutMongoModule,
    SellerPayoutMongoModule,
    PaymentMongoModule,
    ReturnMongoModule,
  ],
  controllers: [CompanyDashboardController, AdminDashboardController],
  providers: [CompanyDashboardService, AdminDashboardService],
  exports: [CompanyDashboardService, AdminDashboardService],
})
export class DashboardModule {}
