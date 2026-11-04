import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'صيغة البريد الإلكتروني غير صحيحة' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;

  @ApiProperty({
    description: '6-digit OTP code sent to user email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @IsString({ message: 'يجب أن يكون رمز التحقق نصاً' })
  @Length(6, 6, { message: 'يجب أن يتكون رمز التحقق من 6 أرقام' })
  otp: string;
}
