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
import { Type } from 'class-transformer';
import { RefundMethodEnum } from '../../../common/enums/return-status.enum';

export class ReturnItemDto {
  @IsNotEmpty()
  @IsMongoId()
  productId: string;

  @IsNotEmpty()
  @IsString()
  sku: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class CreateReturnRequestDto {
  @IsNotEmpty()
  @IsMongoId()
  orderId: string;

  @IsNotEmpty()
  @IsMongoId()
  entityOrderId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @IsOptional()
  @IsString()
  customerReason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proofImages?: string[];

  @IsOptional()
  @IsEnum(RefundMethodEnum)
  refundMethod?: RefundMethodEnum;
}

