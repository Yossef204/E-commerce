import {
  IS_EMAIL,
  IS_NOT_EMPTY,
  IS_PHONE_NUMBER,
  IS_STRONG_PASSWORD,
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
