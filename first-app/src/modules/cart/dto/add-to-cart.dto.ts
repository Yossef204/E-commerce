import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddToCartDto {
  @IsNotEmpty({ message: 'معرف المنتج مطلوب' })
  @IsString()
  productId: string;

  @IsNotEmpty({ message: 'رمز الصنف variantSku مطلوب' })
  @IsString()
  variantSku: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'الكمية يجب أن تكون 1 على الأقل' })
  quantity?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  sellingEntityId?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;
}

