import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TCategory = Category & Document;

@Schema({ timestamps: true })
export class Category {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, unique: true })
  name: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: String })
  image: string;

  @Prop({ type: String })
  folderId: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
