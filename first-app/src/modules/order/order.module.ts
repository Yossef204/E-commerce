import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderFactory } from './factory/order.factory';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { InventoryMongoModule } from '../../shared/modules/inventory.mongo.module';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { EscrowMongoModule } from '../../shared/modules/escrow.mongo.module';
import { LedgerMongoModule } from '../../shared/modules/ledger.mongo.module';
import { PaymentMongoModule } from '../../shared/modules/payment.mongo.module';
import { JwtModule } from '@nestjs/jwt';
import { PermissionsModule } from '../permissions/permissions.module';
import { CouponModule } from '../coupon/coupon.module';
import { SharedPaymentModule } from '../../shared/payment/shared-payment.module';
import { NotificationModule } from '../notification/notification.module';
import { MailModule } from '../../shared/mailer/mail.module';

@Module({
  imports: [
    OrderMongoModule,
    InventoryMongoModule,
    ProductMongoModule,
    SellingEntityMongoModule,
    UserMongoModule,
    EscrowMongoModule,
    LedgerMongoModule,
    PaymentMongoModule,
    PermissionsModule,
    JwtModule,
    CouponModule,
    SharedPaymentModule,
    NotificationModule,
    MailModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderFactory],
  exports: [OrderService],
})
export class OrderModule {}
