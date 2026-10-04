import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { CouponScopeEnum } from '../../common/enums/coupon-scope.enum';
import { DiscountTypeEnum } from '../../common/enums/discount-type.enum';

export type TCoupon = Coupon & Document;

@Schema({ timestamps: true })
export class Coupon {
  _id: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  })
  code: string;

  @Prop({
    type: String,
    enum: Object.values(CouponScopeEnum),
    required: true,
    default: CouponScopeEnum.PLATFORM,
  })
  scope: CouponScopeEnum;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    default: null,
    index: true,
  })
  sellingEntityId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(DiscountTypeEnum),
    required: true,
  })
  discountType: DiscountTypeEnum;

  @Prop({ type: Number, required: true, min: 0 })
  discountValue: number;

  @Prop({ type: Number, default: null, min: 0 })
  maxDiscountAmount?: number | null;

  @Prop({ type: Number, default: 0, min: 0 })
  minOrderValue: number;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Number, default: 1000, min: 1 })
  usageLimit: number;

  @Prop({ type: Number, default: 0, min: 0 })
  usedCount: number;

  @Prop({ type: Number, default: 1, min: 1 })
  usagePerUser: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// Compound indexes
CouponSchema.index({ sellingEntityId: 1, isActive: 1 });
CouponSchema.index({ startDate: 1, endDate: 1, isActive: 1 });
