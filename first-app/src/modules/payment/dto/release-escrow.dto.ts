import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReleaseEscrowDto {
  @IsNotEmpty()
  @IsString()
  entityOrderId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
