import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BrandRepo } from '../../models/brand/brand.repository';
import { Brand, BrandSchema } from '../../models/brand/brand.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Brand.name,
        schema: BrandSchema,
      },
    ]),
  ],
  controllers: [],
  providers: [BrandRepo],
  exports: [BrandRepo],
})
export class BrandMongoModule {}
