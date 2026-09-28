import { Types } from 'mongoose';

export interface IInventory {
  _id?: Types.ObjectId;
  sku: string;
  variantId?: string;
  productId?: Types.ObjectId;
  availableStock: number;
  reservedStock: number;
}
