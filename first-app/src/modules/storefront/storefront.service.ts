import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductRepo } from '../../models/product/product.repository';
import { CategoryRepo } from '../../models/category/category.repository';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { CatalogFilterInput } from './dto/catalog-filter.input';
import { CategoryType } from './types/category.type';
import { PaginatedProductsType, ProductType } from './types/product.type';
import { SortStrategyFactory } from './strategies/sort-strategy';
import { ProductMapper } from './mappers/product.mapper';

@Injectable()
export class StorefrontService {
  constructor(
    private readonly productRepo: ProductRepo,
    private readonly categoryRepo: CategoryRepo,
  ) {}

  async getStorefrontCategories(): Promise<CategoryType[]> {
    const categories = await this.categoryRepo.getAll({});
    return categories.map((c: any) => {
      const doc = c.toObject ? c.toObject() : c;
      return {
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        description: doc.description,
        image: doc.image,
      };
    });
  }

  async getStorefrontProducts(filter?: CatalogFilterInput): Promise<PaginatedProductsType> {
    const queryFilter: any = {
      approvalStatus: ProductApprovalStatusEnum.APPROVED,
    };

    if (filter?.categoryId && Types.ObjectId.isValid(filter.categoryId)) {
      queryFilter.categoryId = new Types.ObjectId(filter.categoryId);
    }

    if (filter?.brandId && Types.ObjectId.isValid(filter.brandId)) {
      queryFilter.brandId = new Types.ObjectId(filter.brandId);
    }

    if (filter?.search && filter.search.trim()) {
      const searchRegex = { $regex: filter.search.trim(), $options: 'i' };
      queryFilter.$or = [
        { name: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { desc: searchRegex },
        { slug: searchRegex },
      ];
    }

    const page = Math.max(1, Number(filter?.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(filter?.limit) || 12));
    const skip = (page - 1) * limit;

    const sortOption = SortStrategyFactory.getStrategy(
      filter?.sortBy,
      filter?.sortOrder,
    ).applySort();

    const [total, products] = await Promise.all([
      this.productRepo.model.countDocuments(queryFilter).exec(),
      this.productRepo.model
        .find(queryFilter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    const items = products.map((p) => ProductMapper.toGraphQL(p));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      totalPages,
    };
  }

  async getProductDetails(id: string): Promise<ProductType> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف المنتج غير صالح');
    }

    const product = await this.productRepo.model
      .findOne({
        _id: new Types.ObjectId(id),
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
      })
      .exec();

    if (!product) {
      throw new NotFoundException('المنتج المطلوب غير موجود أو لم يتم اعتماده بعد');
    }

    return ProductMapper.toGraphQL(product);
  }
}
