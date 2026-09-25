import { IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class CreateIndependentSellerDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  legalName: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

