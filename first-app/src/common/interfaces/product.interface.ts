import { Types } from 'mongoose';
import { ProductTypeEnum } from '../enums/product-type.enum';
import { ProductApprovalStatusEnum } from '../enums/product-approval-status.enum';

export interface IVariant {
  sku: string;
  price: number;
  attributes?: Record<string, string>;
  isActive?: boolean;
}

export interface IProduct {
  _id?: Types.ObjectId;
  title: string;
  slug: string;
  desc?: string;
  sellingEntityId: Types.ObjectId;
  categoryId: Types.ObjectId;
  subCategoryId?: Types.ObjectId;
  brandId?: Types.ObjectId;
  productType: ProductTypeEnum;
  approvalStatus: ProductApprovalStatusEnum;
  variants: IVariant[];
  image?: string;
  subImages?: string[];
  rejectionReason?: string;
}
