import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from '../../models/review/review.schema';
import { ReviewRepo } from '../../models/review/review.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
  ],
  providers: [ReviewRepo],
  exports: [ReviewRepo],
})
export class ReviewMongoModule {}

