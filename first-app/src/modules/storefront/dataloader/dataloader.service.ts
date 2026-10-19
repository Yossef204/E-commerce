import { Injectable } from '@nestjs/common';
import type DataLoader from 'dataloader';
import * as DataLoaderModule from 'dataloader';
import { CategoryRepo } from '../../../models/category/category.repository';
import { BrandRepo } from '../../../models/brand/brand.repository';
import { InventoryRepo } from '../../../models/inventory/inventory.repository';
import { TCategory } from '../../../models/category/category.schema';
import { TBrand } from '../../../models/brand/brand.schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataLoaderClass: typeof DataLoader =
  (DataLoaderModule as any).default || DataLoaderModule;

export interface IDataloaders {
  categoryLoader: DataLoader<string, TCategory | null>;
  brandLoader: DataLoader<string, TBrand | null>;
  productStockLoader: DataLoader<string, number>;
}

@Injectable()
export class DataloaderService {
  constructor(
    private readonly categoryRepo: CategoryRepo,
    private readonly brandRepo: BrandRepo,
    private readonly inventoryRepo: InventoryRepo,
  ) {}

  public createLoaders(): IDataloaders {
    const categoryLoader = new DataLoaderClass<string, TCategory | null>(
      async (keys: readonly string[]) => {
        const categories = await this.categoryRepo.findManyByIds([...keys]);
        const map = new Map<string, TCategory>();
        for (const cat of categories) {
          map.set(cat._id.toString(), cat);
        }
        return keys.map((key) => map.get(key.toString()) || null);
      },
    );

    const brandLoader = new DataLoaderClass<string, TBrand | null>(
      async (keys: readonly string[]) => {
        const brands = await this.brandRepo.findManyByIds([...keys]);
        const map = new Map<string, TBrand>();
        for (const b of brands) {
          map.set(b._id.toString(), b);
        }
        return keys.map((key) => map.get(key.toString()) || null);
      },
    );

    const productStockLoader = new DataLoaderClass<string, number>(
      async (keys: readonly string[]) => {
        const inventories = await this.inventoryRepo.findByProductIds([...keys]);
        const map = new Map<string, number>();
        for (const inv of inventories) {
          if (!inv.productId) continue;
          const pId = inv.productId.toString();
          const current = map.get(pId) || 0;
          map.set(pId, current + (Number(inv.availableStock) || 0));
        }
        return keys.map((key) => map.get(key.toString()) ?? 0);
      },
    );

    return {
      categoryLoader,
      brandLoader,
      productStockLoader,
    };
  }
}
