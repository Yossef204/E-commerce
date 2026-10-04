import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RequestPayoutDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  sellingEntityId?: string;
}
