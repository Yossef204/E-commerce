import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyCodOtpDto {
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @IsString({ message: 'رمز التحقق يجب أن يكون نصاً' })
  @Length(6, 6, { message: 'رمز التحقق يجب أن يتكون من 6 أرقام' })
  otp: string;
}

