import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import {
  SellingEntity,
  SellingEntitySchema,
} from '../../models/selling-entity/selling-entity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: SellingEntity.name,
        schema: SellingEntitySchema,
      },
    ]),
  ],
  controllers: [],
  providers: [SellingEntityRepo],
  exports: [SellingEntityRepo],
})
export class SellingEntityMongoModule {}

