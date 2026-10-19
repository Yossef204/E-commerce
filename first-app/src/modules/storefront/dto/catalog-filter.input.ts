import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';

@InputType()
export class CatalogFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  brandId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 12;
}
