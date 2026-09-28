import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Inventory, TInventory } from './inventory.schema';

@Injectable()
export class InventoryRepo extends AbstractRepo<TInventory> {
  constructor(@InjectModel(Inventory.name) inventoryModel: Model<TInventory>) {
    super(inventoryModel);
  }

  /**
   * Atomic stock reservation using lock-free conditional query ($gte) and $inc update.
   * Eliminates race conditions and overselling completely.
   */
  public async reserveStockAtomic(
    sku: string,
    quantity: number,
  ): Promise<boolean> {
    const result = await this._model
      .updateOne(
        { sku, availableStock: { $gte: quantity } },
        {
          $inc: {
            availableStock: -quantity,
            reservedStock: quantity,
          },
        },
      )
      .exec();

    return result.modifiedCount > 0;
  }

  /**
   * Atomic stock release to return reserved stock back to available stock (e.g. order cancellation/timeout).
   */
  public async releaseStockAtomic(
    sku: string,
    quantity: number,
  ): Promise<void> {
    await this._model
      .updateOne(
        { sku, reservedStock: { $gte: quantity } },
        {
          $inc: {
            availableStock: quantity,
            reservedStock: -quantity,
          },
        },
      )
      .exec();
  }

  /**
   * Atomic stock commit after payment confirmation to finalize reservation.
   */
  public async commitStockAtomic(sku: string, quantity: number): Promise<void> {
    await this._model
      .updateOne(
        { sku, reservedStock: { $gte: quantity } },
        {
          $inc: {
            reservedStock: -quantity,
          },
        },
      )
      .exec();
  }
}
