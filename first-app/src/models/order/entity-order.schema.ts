import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { OrderItem, OrderItemSchema } from './order-item.schema';

export type TEntityOrder = EntityOrder & Document;

@Schema({ _id: false })
export class StatusHistoryEntry {
  @Prop({
    type: String,
    enum: Object.values(EntityOrderStatusEnum),
    required: true,
  })
  status: EntityOrderStatusEnum;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt: Date;

  @Prop({ type: String, default: null })
  note?: string;
}

export const StatusHistoryEntrySchema =
  SchemaFactory.createForClass(StatusHistoryEntry);

@Schema({ timestamps: true })
export class EntityOrder {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MainOrder',
    required: true,
    index: true,
  })
  mainOrderId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    required: true,
    index: true,
  })
  sellingEntityId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ type: Number, required: true, min: 0 })
  subtotal: number;

  @Prop({
    type: String,
    enum: Object.values(EntityOrderStatusEnum),
    default: EntityOrderStatusEnum.PENDING,
  })
  status: EntityOrderStatusEnum;

  @Prop({ type: [StatusHistoryEntrySchema], default: [] })
  statusHistory: StatusHistoryEntry[];
}

export const EntityOrderSchema = SchemaFactory.createForClass(EntityOrder);

// Compound indexes
EntityOrderSchema.index({ sellingEntityId: 1, status: 1, createdAt: -1 });
EntityOrderSchema.index({ mainOrderId: 1 });
