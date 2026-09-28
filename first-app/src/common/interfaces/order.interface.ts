import { Types } from 'mongoose';
import { MainOrderStatusEnum } from '../enums/main-order-status.enum';
import { EntityOrderStatusEnum } from '../enums/entity-order-status.enum';

export interface IOrderItem {
  variantId: string;
  sku: string;
  titleSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IMainOrder {
  _id?: Types.ObjectId;
  customerId: Types.ObjectId;
  orderNumber: string;
  totalAmount: number;
  status: MainOrderStatusEnum;
  idempotencyKey: string;
  shippingAddress: string;
}

export interface IStatusHistoryEntry {
  status: EntityOrderStatusEnum;
  updatedAt: Date;
  note?: string;
}

export interface IEntityOrder {
  _id?: Types.ObjectId;
  mainOrderId: Types.ObjectId;
  sellingEntityId: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  status: EntityOrderStatusEnum;
  statusHistory: IStatusHistoryEntry[];
}
