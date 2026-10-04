import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';
import { Coupon, CouponSchema } from '../../models/coupon/coupon.schema';
import {
  CouponUsage,
  CouponUsageSchema,
} from '../../models/coupon/coupon-usage.schema';
import { CouponRepo } from '../../models/coupon/coupon.repository';
import { CouponUsageRepo } from '../../models/coupon/coupon-usage.repository';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import { ProductRepo } from '../../models/product/product.repository';
import {
  Inventory,
  InventorySchema,
} from '../../models/inventory/inventory.schema';
import { Product, ProductSchema } from '../../models/product/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: CouponUsage.name, schema: CouponUsageSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CouponController],
  providers: [
    CouponService,
    CouponRepo,
    CouponUsageRepo,
    InventoryRepo,
    ProductRepo,
    JwtService,
  ],
  exports: [CouponService, CouponRepo, CouponUsageRepo],
})
export class CouponModule {}
