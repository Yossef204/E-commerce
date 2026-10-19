import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TPayoutRequest = PayoutRequest & Document;

export enum PayoutRequestStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true })
export class PayoutRequest {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    required: true,
    index: true,
  })
  sellingEntityId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 1 })
  amount: number;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellerPayoutMethod',
    required: true,
  })
  payoutMethodId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  payoutMethodSnapshot: Record<string, any>;

  @Prop({
    type: String,
    enum: Object.values(PayoutRequestStatusEnum),
    default: PayoutRequestStatusEnum.PENDING,
    index: true,
  })
  status: PayoutRequestStatusEnum;

  @Prop({ type: String, default: null })
  gatewayReference?: string;

  @Prop({ type: Date, default: Date.now })
  requestedAt: Date;

  @Prop({ type: Date, default: null })
  processedAt?: Date;

  @Prop({ type: String, default: null })
  rejectionReason?: string;
}

export const PayoutRequestSchema = SchemaFactory.createForClass(PayoutRequest);

PayoutRequestSchema.index({ sellingEntityId: 1, status: 1, createdAt: -1 });

