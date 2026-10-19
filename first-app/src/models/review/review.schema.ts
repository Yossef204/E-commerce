import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TReview = Review & Document;

@Schema({ timestamps: true })
export class Review {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  })
  productId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  customerId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MainOrder',
    required: true,
    index: true,
  })
  orderId: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    min: 1,
    max: 5,
  })
  rating: number;

  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 1000,
  })
  comment: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  isVerifiedPurchase: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Unique compound index: One review per customer per product
ReviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });
ReviewSchema.index({ productId: 1, rating: -1, createdAt: -1 });

