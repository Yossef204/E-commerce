import { IsNotEmpty, IsString } from 'class-validator';

export class ProcessPayoutDto {
  @IsNotEmpty()
  @IsString()
  sellingEntityId: string;
}

