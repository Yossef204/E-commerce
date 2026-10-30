import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class RegisterAuthDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsStrongPassword()
  password: string;

  @IsPhoneNumber('EG')
  phoneNumber: string;

  @IsNotEmpty()
  @MinLength(3)
  userName: string;
}
