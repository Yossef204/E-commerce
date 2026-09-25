import { IsEmail, IsNotEmpty, IsOptional, IsString, IsStrongPassword } from 'class-validator';

export class LoginAuthDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
