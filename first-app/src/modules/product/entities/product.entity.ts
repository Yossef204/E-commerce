import { Types } from 'mongoose';
import { ProductTypeEnum } from '../../../common/enums/product-type.enum';
import { ProductApprovalStatusEnum } from '../../../common/enums/product-approval-status.enum';

export class ProductVariantEntity {
  _id?: Types.ObjectId;
  sku: string;
  price: number;
  attributes?: Record<string, string>;
  isActive?: boolean;
}

export class ProductEntity {
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
  variants: ProductVariantEntity[];
  image?: string;
  subImages?: string[];
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
