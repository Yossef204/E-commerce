import { IsEmail, IsNotEmpty, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'صيغة البريد الإلكتروني غير صحيحة' })
  email: string;

  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @Length(6, 6, { message: 'يجب أن يتكون رمز التحقق من 6 أرقام' })
  otp: string;

  @IsNotEmpty({ message: 'كلمة المرور الجديدة مطلوبة' })
  @MinLength(6, { message: 'يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام' })
  newPassword: string;
}

