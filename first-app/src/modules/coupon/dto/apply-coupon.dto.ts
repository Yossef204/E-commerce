import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}
