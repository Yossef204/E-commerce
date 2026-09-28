import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CheckoutItemDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}
