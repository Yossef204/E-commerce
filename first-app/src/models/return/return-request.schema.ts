import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import {
  ReturnStatusEnum,
  InspectionResultEnum,
  RefundMethodEnum,
} from '../../common/enums/return-status.enum';

export type TReturnRequest = ReturnRequest & Document;

@Schema({ _id: false })
export class ReturnItem {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  sku: string;

  @Prop({ type: Number, required: true, min: 1 })
  quantity: number;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: String, required: true, trim: true })
  reason: string;
}

export const ReturnItemSchema = SchemaFactory.createForClass(ReturnItem);

@Schema({ timestamps: true })
export class ReturnRequest {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MainOrder',
    required: true,
    index: true,
  })
  orderId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EntityOrder',
    required: true,
    index: true,
  })
  entityOrderId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  customerId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    required: true,
    index: true,
  })
  sellingEntityId: Types.ObjectId;

  @Prop({ type: [ReturnItemSchema], required: true })
  items: ReturnItem[];

  @Prop({
    type: String,
    enum: Object.values(ReturnStatusEnum),
    default: ReturnStatusEnum.REQUESTED,
    index: true,
  })
  status: ReturnStatusEnum;

  @Prop({
    type: String,
    enum: Object.values(InspectionResultEnum),
    default: null,
  })
  inspectionResult?: InspectionResultEnum;

  @Prop({ type: Number, required: true, min: 0 })
  refundAmount: number;

  @Prop({
    type: String,
    enum: Object.values(RefundMethodEnum),
    default: RefundMethodEnum.ORIGINAL_PAYMENT,
  })
  refundMethod: RefundMethodEnum;

  @Prop({ type: [String], default: [] })
  proofImages: string[];

  @Prop({ type: String, default: null })
  customerReason?: string;

  @Prop({ type: String, default: null })
  vendorNote?: string;

  @Prop({ type: String, default: null })
  rejectionReason?: string;

  @Prop({ type: Date, default: null })
  refundedAt?: Date;
}

export const ReturnRequestSchema = SchemaFactory.createForClass(ReturnRequest);

ReturnRequestSchema.index({ sellingEntityId: 1, status: 1, createdAt: -1 });
ReturnRequestSchema.index({ customerId: 1, createdAt: -1 });
ReturnRequestSchema.index({ entityOrderId: 1 });

