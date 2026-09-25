import { Types } from 'mongoose';
import { PaymentMethodEnum } from '../enums/payment-method.enum';
import { PaymentStatusEnum } from '../enums/payment-status.enum';
import { EscrowStatusEnum } from '../enums/escrow-status.enum';
import { PayoutStatusEnum } from '../enums/payout-status.enum';

export interface IPayment {
  _id?: Types.ObjectId;
  mainOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethodEnum;
  status: PaymentStatusEnum;
  transactionId: string;
  idempotencyKey: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEscrowLedger {
  _id?: Types.ObjectId;
  mainOrderId: Types.ObjectId;
  entityOrderId: Types.ObjectId;
  sellingEntityId: Types.ObjectId;
  grossAmount: number;
  commissionRate: number;
  platformFee: number;
  netAmount: number;
  status: EscrowStatusEnum;
  releasedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IVendorPayout {
  _id?: Types.ObjectId;
  sellingEntityId: Types.ObjectId;
  escrowIds: Types.ObjectId[];
  totalAmount: number;
  status: PayoutStatusEnum;
  payoutReference: string;
  processedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

