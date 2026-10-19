import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { CategoryType } from './category.type';
import { BrandType } from './brand.type';

@ObjectType('StorefrontProductVariant')
export class ProductVariantType {
  @Field(() => String)
  sku: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int, { nullable: true })
  initialStock?: number;

  @Field(() => Int, { nullable: true })
  availableStock?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@ObjectType('StorefrontProduct')
export class ProductType {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String)
  description: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  stock: number;

  @Field(() => [String])
  images: string[];

  @Field(() => String, { nullable: true })
  brandName?: string;

  // Internal keys used by field resolvers
  categoryId?: string;
  brandId?: string;

  @Field(() => String, { nullable: true })
  sellingEntityId?: string;

  @Field(() => CategoryType, { nullable: true })
  category?: CategoryType;

  @Field(() => BrandType, { nullable: true })
  brand?: BrandType;

  @Field(() => [ProductVariantType], { nullable: true })
  variants?: ProductVariantType[];

  @Field(() => String, { nullable: true })
  createdAt?: string;

  @Field(() => String, { nullable: true })
  updatedAt?: string;
}

@ObjectType('StorefrontProductsResponse')
export class PaginatedProductsType {
  @Field(() => [ProductType])
  items: ProductType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  totalPages: number;
}
