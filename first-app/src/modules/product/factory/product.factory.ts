import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import slugify from 'slugify';
import { CreateProductDto } from '../dto/create-product.dto';
import { Product, ProductVariant } from '../../../models/product/product.schema';
import { ProductTypeEnum } from '../../../common/enums/product-type.enum';
import { ProductApprovalStatusEnum } from '../../../common/enums/product-approval-status.enum';

@Injectable()
export class ProductFactory {
  createProductEntity(dto: CreateProductDto): Product {
    const product = new Product();
    product.title = dto.title.trim();
    product.slug = slugify(dto.title, { lower: true, strict: true }) + '-' + Date.now();
    product.desc = dto.desc || '';
    product.sellingEntityId = new Types.ObjectId(dto.sellingEntityId);
    product.categoryId = new Types.ObjectId(dto.categoryId);

    if (dto.subCategoryId) {
      product.subCategoryId = new Types.ObjectId(dto.subCategoryId);
    }
    if (dto.brandId) {
      product.brandId = new Types.ObjectId(dto.brandId);
    }

    product.productType = dto.productType || ProductTypeEnum.SIMPLE;
    product.approvalStatus = ProductApprovalStatusEnum.PENDING_APPROVAL;
    product.image = dto.image || '';
    product.subImages = dto.subImages || [];

    product.variants = dto.variants.map((vDto) => {
      const variant = new ProductVariant();
      variant._id = new Types.ObjectId();
      variant.sku = vDto.sku.trim();
      variant.price = vDto.price;
      variant.attributes = vDto.attributes || {};
      variant.isActive = vDto.isActive !== undefined ? vDto.isActive : true;
      return variant;
    });

    return product;
  }
}
