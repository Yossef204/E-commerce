import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { ProductTypeEnum } from '../../common/enums/product-type.enum';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';

export type TProduct = Product & Document;

@Schema({ _id: true, timestamps: true })
export class ProductVariant {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  sku: string;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  attributes: Record<string, string>;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const ProductVariantSchema = SchemaFactory.createForClass(ProductVariant);

@Schema({ timestamps: true })
export class Product {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true, index: true })
  slug: string;

  @Prop({ type: String, default: null })
  desc: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellingEntity',
    required: true,
    index: true,
  })
  sellingEntityId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  categoryId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' })
  subCategoryId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' })
  brandId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ProductTypeEnum),
    default: ProductTypeEnum.SIMPLE,
  })
  productType: ProductTypeEnum;

  @Prop({
    type: String,
    enum: Object.values(ProductApprovalStatusEnum),
    default: ProductApprovalStatusEnum.PENDING_APPROVAL,
  })
  approvalStatus: ProductApprovalStatusEnum;

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants: ProductVariant[];

  @Prop({ type: String, default: null })
  image: string;

  @Prop({ type: [String], default: [] })
  subImages: string[];

  @Prop({ type: String, default: null })
  rejectionReason: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Compound indexes
ProductSchema.index({ sellingEntityId: 1, approvalStatus: 1 });
ProductSchema.index({ categoryId: 1, approvalStatus: 1 });

// Text index for fast search
ProductSchema.index({ title: 'text', slug: 'text' });
