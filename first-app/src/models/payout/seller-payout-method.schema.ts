import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TSellerPayoutMethod = SellerPayoutMethod & Document;

export enum PayoutMethodTypeEnum {
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  VODAFONE_CASH = 'VODAFONE_CASH',
  INSTAPAY = 'INSTAPAY',
}

@Schema({ timestamps: true })
export class SellerPayoutMethod {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    required: true,
    index: true,
  })
  sellingEntityId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(PayoutMethodTypeEnum),
    required: true,
  })
  type: PayoutMethodTypeEnum;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: true })
  details: {
    // BANK_ACCOUNT
    accountHolderName?: string;
    bankName?: string;
    iban?: string;
    swiftCode?: string;

    // VODAFONE_CASH
    walletNumber?: string;

    // INSTAPAY
    instaPayAddress?: string;

    [key: string]: any;
  };

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: true })
  isVerified: boolean;
}

export const SellerPayoutMethodSchema =
  SchemaFactory.createForClass(SellerPayoutMethod);

SellerPayoutMethodSchema.index({ sellingEntityId: 1, isDefault: 1 });
SellerPayoutMethodSchema.index({ sellingEntityId: 1, type: 1 });

