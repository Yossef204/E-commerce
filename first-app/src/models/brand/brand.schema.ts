import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TBrand = Brand & Document;

@Schema({ timestamps: true })
export class Brand {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: String })
  image?: string;

  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'Category', default: [] })
  categoryId: Types.ObjectId[];

  @Prop({ type: String })
  folderId?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    default: null,
    index: true,
  })
  sellingEntityId?: Types.ObjectId | null;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted?: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);

BrandSchema.index({ slug: 1 });
BrandSchema.index({ isDeleted: 1, name: 1 });
BrandSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
