import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { EntityTypeEnum } from '../../common/enums/entity-type.enum';
import { EntityStatusEnum } from '../../common/enums/entity-status.enum';

export type TSellingEntity = SellingEntity & Document;

@Schema({ _id: false })
export class BusinessDetails {
  @Prop({ type: String, default: null, trim: true })
  taxNumber?: string;

  @Prop({ type: String, default: null, trim: true })
  commercialRegister?: string;

  @Prop({ type: String, default: null, trim: true })
  phone?: string;

  @Prop({ type: String, default: null, trim: true })
  address?: string;
}

export const BusinessDetailsSchema = SchemaFactory.createForClass(BusinessDetails);

@Schema({ timestamps: true })
export class SellingEntity {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  legalName: string;

  @Prop({
    type: String,
    enum: Object.values(EntityTypeEnum),
    required: true,
  })
  type: EntityTypeEnum;

  @Prop({
    type: String,
    enum: Object.values(EntityStatusEnum),
    default: EntityStatusEnum.PENDING_APPROVAL,
  })
  status: EntityStatusEnum;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  primaryOwnerId: Types.ObjectId;

  @Prop({ type: BusinessDetailsSchema, default: {} })
  businessDetails: BusinessDetails;

  @Prop({ type: String, default: null })
  rejectionReason?: string;
}

export const SellingEntitySchema = SchemaFactory.createForClass(SellingEntity);

// Compound indexes
SellingEntitySchema.index({ type: 1, status: 1 });
SellingEntitySchema.index({ primaryOwnerId: 1 });

