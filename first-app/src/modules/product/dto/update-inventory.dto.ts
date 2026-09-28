import { IsIn, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class UpdateInventoryDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsIn(['ADD', 'SET'])
  @IsNotEmpty()
  operation: 'ADD' | 'SET';
}
