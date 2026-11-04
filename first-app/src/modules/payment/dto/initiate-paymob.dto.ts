import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiatePaymobDto {
  @ApiProperty({ description: 'Payment amount in EGP', example: 150 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'Internal merchant order ID or Order Number',
    example: 'ORD-12345',
  })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Customer billing details to embed in payment key',
  })
  @IsObject()
  @IsOptional()
  billingData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    city?: string;
    street?: string;
    building?: string;
    apartment?: string;
    floor?: string;
    postalCode?: string;
    country?: string;
    state?: string;
    [key: string]: any;
  };

  @ApiPropertyOptional({
    description: 'Order items to attach to Paymob ecommerce order',
  })
  @IsArray()
  @IsOptional()
  items?: any[];
}

