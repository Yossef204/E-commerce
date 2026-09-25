import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TBrand = Brand & Document;
@Schema({ timestamps: true })
export class Brand {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, unique: true })
  name: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: String })
  image: string;

  @Prop({ type: [mongoose.Schema.Types.ObjectId] })
  categoryId: Types.ObjectId[];

  @Prop({ type: String })
  folderId: string;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);
