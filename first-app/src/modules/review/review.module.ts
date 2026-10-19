import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReviewMongoModule } from '../../shared/modules/review.mongo.module';
import { ProductMongoModule } from '../../shared/modules/product.mongo.module';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    ReviewMongoModule,
    ProductMongoModule,
    OrderMongoModule,
    JwtModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}

