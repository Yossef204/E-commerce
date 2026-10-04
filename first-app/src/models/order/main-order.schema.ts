import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { MainOrderStatusEnum } from '../../common/enums/main-order-status.enum';

export type TMainOrder = MainOrder & Document;

@Schema({ timestamps: true })
export class MainOrder {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  customerId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true, index: true })
  orderNumber: string;

  @Prop({ type: Number, required: true, min: 0 })
  totalAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  discountAmount: number;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null,
  })
  couponId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  couponCode?: string | null;

  @Prop({
    type: String,
    enum: Object.values(MainOrderStatusEnum),
    default: MainOrderStatusEnum.PENDING_PAYMENT,
  })
  status: MainOrderStatusEnum;

  @Prop({ type: String, required: true, unique: true, index: true })
  idempotencyKey: string;

  @Prop({ type: String, required: true })
  shippingAddress: string;
}

export const MainOrderSchema = SchemaFactory.createForClass(MainOrder);

// Compound index
MainOrderSchema.index({ customerId: 1, createdAt: -1 });
