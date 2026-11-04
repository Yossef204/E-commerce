import { Transform } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiProperty({ description: 'Brand name', example: 'Nike' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Brand name must be a string' })
  @IsNotEmpty({ message: 'Brand name cannot be empty' })
  @MinLength(2, { message: 'Brand name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Brand name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Category IDs associated with this brand',
    example: ['6ab2c7bef84808feea26dd6d'],
    type: [String],
  })
  @IsArray({ message: 'categoryId must be an array of Mongo IDs' })
  @IsMongoId({ each: true, message: 'Each categoryId must be a valid Mongo ObjectId' })
  categoryId: string[];

  @ApiPropertyOptional({ description: 'Brand image URL' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ description: 'Cloud folder ID' })
  @IsString()
  @IsOptional()
  folderId?: string;
}
