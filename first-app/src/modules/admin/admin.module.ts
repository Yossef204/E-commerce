import { Module } from '@nestjs/common';
import { AdminSellerService } from './services/admin-seller.service';
import { SellingEntityMongoModule } from '../../shared/modules/selling-entity.mongo.module';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { BrandMongoModule } from '../../shared/modules/brand.mongo.module';

@Module({
  imports: [
    SellingEntityMongoModule,
    UserMongoModule,
    BrandMongoModule,
  ],
  providers: [AdminSellerService],
  exports: [AdminSellerService],
})
export class AdminModule {}

