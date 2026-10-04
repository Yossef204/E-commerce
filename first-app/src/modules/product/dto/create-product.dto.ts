import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductTypeEnum } from '../../../common/enums/product-type.enum';
import { CreateVariantDto } from './create-variant.dto';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  desc?: string;

  @IsMongoId()
  @IsOptional()
  sellingEntityId?: string;

  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;

  @IsMongoId()
  @IsOptional()
  subCategoryId?: string;

  @IsMongoId()
  @IsOptional()
  brandId?: string;

  @IsEnum(ProductTypeEnum)
  @IsOptional()
  productType?: ProductTypeEnum;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  initialStock?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @IsString()
  @IsOptional()
  image?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subImages?: string[];
}
