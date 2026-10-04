import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';
import { IEscrowLedger } from '../../common/interfaces/payment.interface';

export type TEscrow = IEscrowLedger & Document;

@Schema({ timestamps: true })
export class EscrowLedger {
  @Prop({ type: Types.ObjectId, ref: 'MainOrder', required: false, default: null })
  mainOrderId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EntityOrder',
    required: true,
    unique: true,
  })
  entityOrderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SellingEntity', required: true })
  sellingEntityId: Types.ObjectId;

  @Prop({ required: true, type: Number })
  grossAmount: number;

  @Prop({ type: Number })
  subtotal?: number;

  @Prop({ required: false, type: Number, default: 0.1 })
  commissionRate?: number;

  @Prop({ type: Number, default: 10 })
  commissionPercentage?: number;

  @Prop({ type: Number, default: 0 })
  commissionFixedFee?: number;

  @Prop({ required: true, type: Number })
  platformFee: number;

  @Prop({ type: Number })
  commissionAmount?: number;

  @Prop({ required: true, type: Number })
  netAmount: number;

  @Prop({
    required: true,
    enum: EscrowStatusEnum,
    default: EscrowStatusEnum.HELD,
    type: String,
  })
  status: EscrowStatusEnum;

  @Prop({ type: Date })
  releasedAt?: Date;
}

export const EscrowLedgerSchema = SchemaFactory.createForClass(EscrowLedger);

EscrowLedgerSchema.index({ entityOrderId: 1 }, { unique: true });
EscrowLedgerSchema.index({ sellingEntityId: 1, status: 1 });
EscrowLedgerSchema.index({ mainOrderId: 1 });
