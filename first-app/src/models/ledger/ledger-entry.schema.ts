import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { LedgerAccountEnum } from '../../common/enums/ledger-account.enum';
import { LedgerEntryTypeEnum } from '../../common/enums/ledger-entry-type.enum';

export type TLedgerEntry = LedgerEntry & Document;

export enum LedgerMovementTypeEnum {
  ORDER_CREDIT = 'ORDER_CREDIT',
  PLATFORM_FEE_DEBIT = 'PLATFORM_FEE_DEBIT',
  PAYOUT_DEBIT = 'PAYOUT_DEBIT',
  REFUND_DEBIT = 'REFUND_DEBIT',
}

export enum LedgerEntryStatusEnum {
  HELD_ESCROW = 'HELD_ESCROW',
  AVAILABLE = 'AVAILABLE',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class LedgerEntry {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    required: true,
    index: true,
  })
  sellingEntityId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EntityOrder',
    default: null,
    index: true,
  })
  entityOrderId?: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MainOrder',
    default: null,
    index: true,
  })
  orderId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(LedgerMovementTypeEnum),
    default: LedgerMovementTypeEnum.ORDER_CREDIT,
    index: true,
  })
  entryType: LedgerMovementTypeEnum;

  @Prop({
    type: String,
    enum: Object.values(LedgerAccountEnum),
    default: LedgerAccountEnum.ESCROW_HOLDING,
  })
  account: LedgerAccountEnum;

  @Prop({
    type: String,
    enum: Object.values(LedgerEntryTypeEnum),
    default: LedgerEntryTypeEnum.CREDIT,
  })
  type: LedgerEntryTypeEnum;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, default: 'EGP' })
  currency: string;

  @Prop({ type: Number, default: 0 })
  balanceAfter: number;

  @Prop({
    type: String,
    enum: Object.values(LedgerEntryStatusEnum),
    default: LedgerEntryStatusEnum.HELD_ESCROW,
    index: true,
  })
  status: LedgerEntryStatusEnum;

  @Prop({ type: String, default: null })
  paymentMethod?: string;

  @Prop({ type: String, default: null })
  reference?: string;

  @Prop({ type: String, required: true, trim: true })
  description: string;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);

LedgerEntrySchema.index({ sellingEntityId: 1, status: 1, createdAt: -1 });
LedgerEntrySchema.index({ sellingEntityId: 1, account: 1 });
LedgerEntrySchema.index({ entityOrderId: 1 });
LedgerEntrySchema.index({ orderId: 1 });
