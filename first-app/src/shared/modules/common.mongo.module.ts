import { Module } from '@nestjs/common';
import { ProductMongoModule } from './product.mongo.module';
import { BrandMongoModule } from './brand.mongo.module';
import { CategoryMongoModule } from './category.mongo.module';

@Module({
  imports: [ProductMongoModule, BrandMongoModule, CategoryMongoModule],
})
export class CommonMongoModule {}
