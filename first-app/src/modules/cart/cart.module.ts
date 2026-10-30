import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Cart, CartSchema } from '../../models/cart/cart.schema';
import { CartRepo } from '../../models/cart/cart.repository';
import { Product, ProductSchema } from '../../models/product/product.schema';
import { ProductRepo } from '../../models/product/product.repository';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartRepo, ProductRepo, JwtService],
  exports: [CartService, CartRepo],
})
export class CartModule {}

