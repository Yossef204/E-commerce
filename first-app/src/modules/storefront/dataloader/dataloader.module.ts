import { Module } from '@nestjs/common';
import { DataloaderService } from './dataloader.service';
import { CategoryMongoModule } from '../../../shared/modules/category.mongo.module';
import { BrandMongoModule } from '../../../shared/modules/brand.mongo.module';
import { InventoryMongoModule } from '../../../shared/modules/inventory.mongo.module';

@Module({
  imports: [CategoryMongoModule, BrandMongoModule, InventoryMongoModule],
  providers: [DataloaderService],
  exports: [DataloaderService],
})
export class DataloaderModule {}
