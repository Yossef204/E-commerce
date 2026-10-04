import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Seller {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    default: null,
    index: true,
  })
  sellingEntityId?: Types.ObjectId;
}

export const sellerSchema = SchemaFactory.createForClass(Seller);