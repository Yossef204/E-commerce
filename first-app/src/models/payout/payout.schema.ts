import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PayoutStatusEnum } from '../../common/enums/payout-status.enum';
import { IVendorPayout } from '../../common/interfaces/payment.interface';

export type TPayout = IVendorPayout & Document;

@Schema({ timestamps: true })
export class VendorPayout {
  @Prop({ type: Types.ObjectId, ref: 'SellingEntity', required: true })
  sellingEntityId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'EscrowLedger' }], required: true })
  escrowIds: Types.ObjectId[];

  @Prop({ required: true, type: Number })
  totalAmount: number;

  @Prop({ required: true, enum: PayoutStatusEnum, default: PayoutStatusEnum.PENDING, type: String })
  status: PayoutStatusEnum;

  @Prop({ required: true, type: String, unique: true })
  payoutReference: string;

  @Prop({ type: Date })
  processedAt?: Date;
}

export const VendorPayoutSchema = SchemaFactory.createForClass(VendorPayout);

VendorPayoutSchema.index({ sellingEntityId: 1, status: 1, createdAt: -1 });

