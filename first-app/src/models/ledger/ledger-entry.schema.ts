import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { LedgerAccountEnum } from '../../common/enums/ledger-account.enum';
import { LedgerEntryTypeEnum } from '../../common/enums/ledger-entry-type.enum';

export type TLedgerEntry = LedgerEntry & Document;

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
    type: String,
    enum: Object.values(LedgerAccountEnum),
    required: true,
  })
  account: LedgerAccountEnum;

  @Prop({
    type: String,
    enum: Object.values(LedgerEntryTypeEnum),
    required: true,
  })
  type: LedgerEntryTypeEnum;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: String, default: null })
  reference?: string;

  @Prop({ type: String, required: true, trim: true })
  description: string;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);

LedgerEntrySchema.index({ sellingEntityId: 1, account: 1 });
LedgerEntrySchema.index({ entityOrderId: 1 });
