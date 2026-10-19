import { Module } from '@nestjs/common';
import { StorefrontResolver } from './storefront.resolver';
import { StorefrontService } from './storefront.service';
import { DataloaderModule } from './dataloader/dataloader.module';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { CategoryMongoModule } from '../../shared/modules/category.mongo.module';
import { BrandMongoModule } from '../../shared/modules/brand.mongo.module';

@Module({
  imports: [
    ProductMongoModule,
    CategoryMongoModule,
    BrandMongoModule,
    DataloaderModule,
  ],
  providers: [StorefrontResolver, StorefrontService],
  exports: [StorefrontService, DataloaderModule],
})
export class StorefrontModule {}
