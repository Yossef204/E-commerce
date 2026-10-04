import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountTypeEnum } from '../../../common/enums/discount-type.enum';

export class CreateVendorCouponDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  code: string;

  @IsEnum(DiscountTypeEnum)
  discountType: DiscountTypeEnum;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usagePerUser?: number;
}
