import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  @IsMongoId()
  productId: string;

  @IsOptional()
  @IsMongoId()
  orderId?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  comment: string;
}

