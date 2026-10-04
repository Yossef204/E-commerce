import { Module } from '@nestjs/common';
import { SellingEntityController } from './selling-entity.controller';
import { SellingEntityService } from './selling-entity.service';
import { SellingEntityFactory } from './factory/selling-entity.factory';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { EscrowMongoModule } from '../../shared/modules/escrow.mongo.module';
import { PayoutMongoModule } from '../../shared/modules/payout.mongo.module';
import { BrandMongoModule } from '../../shared/modules/brand.mongo.module';
import { JwtModule } from '@nestjs/jwt';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    SellingEntityMongoModule,
    UserMongoModule,
    BrandMongoModule,
    ProductMongoModule,
    OrderMongoModule,
    EscrowMongoModule,
    PayoutMongoModule,
    PermissionsModule,
    JwtModule,
  ],
  controllers: [SellingEntityController],
  providers: [SellingEntityService, SellingEntityFactory],
  exports: [SellingEntityService],
})
export class SellingEntityModule {}
