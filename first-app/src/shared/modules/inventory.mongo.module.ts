import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import {
  Inventory,
  InventorySchema,
} from '../../models/inventory/inventory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Inventory.name,
        schema: InventorySchema,
      },
    ]),
  ],
  controllers: [],
  providers: [InventoryRepo],
  exports: [InventoryRepo],
})
export class InventoryMongoModule {}
