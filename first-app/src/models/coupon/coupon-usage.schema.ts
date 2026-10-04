import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TCouponUsage = CouponUsage & Document;

@Schema({ timestamps: true })
export class CouponUsage {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true,
    index: true,
  })
  couponId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MainOrder',
    required: true,
    index: true,
  })
  orderId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  discountAmount: number;
}

export const CouponUsageSchema = SchemaFactory.createForClass(CouponUsage);

// Compound index
CouponUsageSchema.index({ couponId: 1, userId: 1 });
