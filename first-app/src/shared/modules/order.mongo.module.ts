import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MainOrder,
  MainOrderSchema,
} from '../../models/order/main-order.schema';
import {
  EntityOrder,
  EntityOrderSchema,
} from '../../models/order/entity-order.schema';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MainOrder.name, schema: MainOrderSchema },
      { name: EntityOrder.name, schema: EntityOrderSchema },
    ]),
  ],
  providers: [MainOrderRepo, EntityOrderRepo],
  exports: [MainOrderRepo, EntityOrderRepo],
})
export class OrderMongoModule {}
