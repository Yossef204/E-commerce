import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateCartItemDto {
  @IsNotEmpty({ message: 'معرف المنتج مطلوب' })
  @IsString()
  productId: string;

  @IsNotEmpty({ message: 'رمز الصنف variantSku مطلوب' })
  @IsString()
  variantSku: string;

  @IsNotEmpty({ message: 'الكمية مطلوبة' })
  @IsNumber()
  quantity: number;
}

