import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsStrongPassword,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RolesEnum } from '../../../common/enums/roles';

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

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEnum(RolesEnum, { message: 'الدور المحدد غير صالح' })
  role?: RolesEnum;
}
