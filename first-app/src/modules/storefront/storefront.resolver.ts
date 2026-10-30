import {
  Resolver,
  Query,
  Args,
  ID,
  Int,
  ResolveField,
  Parent,
  Context,
} from '@nestjs/graphql';
import { StorefrontService } from './storefront.service';
import { CategoryType } from './types/category.type';
import { BrandType } from './types/brand.type';
import { PaginatedProductsType, ProductType } from './types/product.type';
import { CatalogFilterInput } from './dto/catalog-filter.input';
import { IDataloaders } from './dataloader/dataloader.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Resolver(() => ProductType)
export class StorefrontResolver {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Query(() => [CategoryType], {
    name: 'getStorefrontCategories',
    description: 'جلب كافة التصنيفات النشطة للعملاء في واجهة المتجر',
  })
  async getStorefrontCategories(): Promise<CategoryType[]> {
    return this.storefrontService.getStorefrontCategories();
  }

  @Query(() => PaginatedProductsType, {
    name: 'getStorefrontProducts',
    description: 'جلب المنتجات المعتمدة فقط مع دعم البحث والفلترة والترتيب والترقيم',
  })
  async getStorefrontProducts(
    @Args('filter', { type: () => CatalogFilterInput, nullable: true })
    filter?: CatalogFilterInput,
  ): Promise<PaginatedProductsType> {
    return this.storefrontService.getStorefrontProducts(filter);
  }

  @Query(() => ProductType, {
    name: 'getProductDetails',
    description: 'جلب تفاصيل منتج معتمد بالمعرف الخاص به',
  })
  async getProductDetails(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ProductType> {
    return this.storefrontService.getProductDetails(id);
  }

  @ResolveField(() => CategoryType, { nullable: true })
  async category(
    @Parent() product: ProductType,
    @Context('loaders') loaders?: IDataloaders,
  ): Promise<CategoryType | null> {
    if (!product.categoryId || !loaders?.categoryLoader) {
      return null;
    }
    const catDoc = await loaders.categoryLoader.load(product.categoryId);
    if (!catDoc) return null;
    return {
      id: catDoc._id.toString(),
      name: catDoc.name,
      slug: catDoc.slug,
      description: catDoc.description,
      image: catDoc.image,
    };
  }

  @ResolveField(() => BrandType, { nullable: true })
  async brand(
    @Parent() product: ProductType,
    @Context('loaders') loaders?: IDataloaders,
  ): Promise<BrandType | null> {
    if (!product.brandId || !loaders?.brandLoader) {
      return null;
    }
    const brandDoc = await loaders.brandLoader.load(product.brandId);
    if (!brandDoc) return null;
    return {
      id: brandDoc._id.toString(),
      name: brandDoc.name,
      slug: brandDoc.slug,
    };
  }

  @ResolveField(() => String, { nullable: true })
  async brandName(
    @Parent() product: ProductType,
    @Context('loaders') loaders?: IDataloaders,
  ): Promise<string> {
    if (product.brandName) {
      return product.brandName;
    }
    if (product.brandId && loaders?.brandLoader) {
      const brandDoc = await loaders.brandLoader.load(product.brandId);
      return brandDoc?.name || '';
    }
    return '';
  }

  @ResolveField(() => Int)
  async stock(
    @Parent() product: ProductType,
    @Context('loaders') loaders?: IDataloaders,
  ): Promise<number> {
    if (loaders?.productStockLoader && product.id) {
      const dbStock = await loaders.productStockLoader.load(product.id);
      if (typeof dbStock === 'number' && dbStock > 0) {
        return dbStock;
      }
    }
    return product.stock || 0;
  }
}
