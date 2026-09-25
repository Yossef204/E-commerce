import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderFactory } from './factory/order.factory';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { InventoryMongoModule } from '../../shared/modules/inventory.mongo.module';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    OrderMongoModule,
    InventoryMongoModule,
    ProductMongoModule,
    SellingEntityMongoModule,
    UserMongoModule,
    JwtModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderFactory],
  exports: [OrderService],
})
export class OrderModule {}

