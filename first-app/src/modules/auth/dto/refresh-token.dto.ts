import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

