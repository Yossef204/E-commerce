import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { PaymentStatusEnum } from '../../common/enums/payment-status.enum';
import { IPayment } from '../../common/interfaces/payment.interface';

export type TPayment = IPayment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'MainOrder', required: true })
  mainOrderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true, type: String, default: 'USD' })
  currency: string;

  @Prop({ required: true, enum: PaymentMethodEnum, type: String })
  paymentMethod: PaymentMethodEnum;

  @Prop({ required: true, enum: PaymentStatusEnum, default: PaymentStatusEnum.PENDING, type: String })
  status: PaymentStatusEnum;

  @Prop({ required: true, type: String })
  transactionId: string;

  @Prop({ required: true, type: String, unique: true })
  idempotencyKey: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ idempotencyKey: 1 }, { unique: true });
PaymentSchema.index({ mainOrderId: 1, status: 1 });
PaymentSchema.index({ customerId: 1, createdAt: -1 });

