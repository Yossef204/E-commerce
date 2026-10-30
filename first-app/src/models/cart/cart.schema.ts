import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TCartItem = CartItem & Document;

@Schema({ _id: false })
export class CartItem {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: String, required: true })
  variantSku: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: Number, required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'SellingEntity', required: true })
  sellingEntityId: Types.ObjectId;

  @Prop({ type: String, default: '' })
  image?: string;

  @Prop({ type: String, default: '' })
  vendorName?: string;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

export type TCart = Cart & Document;

@Schema({ timestamps: true })
export class Cart {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  customerId: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ type: Number, default: 0 })
  totalQuantity: number;

  @Prop({ type: Number, default: 0 })
  totalPrice: number;
}

export const CartSchema = SchemaFactory.createForClass(Cart);

