import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TInventory = Inventory & Document;

@Schema({ timestamps: true })
export class Inventory {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  sku: string;

  @Prop({ type: String, default: null })
  variantId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  availableStock: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  reservedStock: number;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

// Compound index for atomic queries
InventorySchema.index({ sku: 1, availableStock: 1 });

