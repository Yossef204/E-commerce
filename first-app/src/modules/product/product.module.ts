import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductFactory } from './factory/product.factory';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { InventoryMongoModule } from '../../shared/modules/inventory.mongo.module';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { JwtModule } from '@nestjs/jwt';
import { PermissionsModule } from '../permissions/permissions.module';

import { BrandMongoModule } from '../../shared/modules/brand.mongo.module';

@Module({
  imports: [
    ProductMongoModule,
    InventoryMongoModule,
    SellingEntityMongoModule,
    UserMongoModule,
    BrandMongoModule,
    PermissionsModule,
    JwtModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, ProductFactory],
  exports: [ProductService],
})
export class ProductModule {}
