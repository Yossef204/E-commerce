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
