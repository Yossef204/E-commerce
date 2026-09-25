import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../../models/product/product.schema';
import { ProductRepo } from '../../models/product/product.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Product.name,
        schema: ProductSchema,
      },
    ]),
  ],
  controllers: [],
  providers: [ProductRepo],
  exports: [ProductRepo],
})
export class ProductMongoModule {}
