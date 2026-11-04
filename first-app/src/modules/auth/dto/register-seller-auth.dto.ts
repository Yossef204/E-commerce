import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
  MinLength,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolesEnum } from '../../../common/enums/roles';

export class RegisterSellerAuthDto {
  @ApiProperty({
    example: 'Ahmed Ali',
    description: 'Full name or username of the seller / company admin',
  })
  @IsString()
  @IsNotEmpty({ message: 'اسم المستخدم مطلوب' })
  @MinLength(3, { message: 'اسم المستخدم يجب ألا يقل عن 3 أحرف' })
  userName: string;

  @ApiProperty({
    example: 'seller@example.com',
    description: 'Business or personal email address',
  })
  @IsEmail({}, { message: 'صيغة البريد الإلكتروني غير صحيحة' })
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Strong password for account access',
  })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'كلمة المرور يجب أن تكون 8 أحرف على الأقل، وتحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص',
    },
  )
  password: string;

  @ApiProperty({
    example: '+201012345678',
    description: 'Contact phone number in international format',
  })
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @IsPhoneNumber('EG', { message: 'رقم الهاتف يجب أن يكون رقم مصري صالح' })
  phoneNumber: string;

  @ApiProperty({
    enum: [RolesEnum.SELLER, RolesEnum.COMPANY_ADMIN],
    example: RolesEnum.SELLER,
    description: 'Requested role: SELLER or COMPANY_ADMIN',
  })
  @IsNotEmpty({ message: 'نوع الحساب (الدور) مطلوب' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'company_admin') return RolesEnum.COMPANY_ADMIN;
      if (lower === 'admin' || lower === 'super_admin') {
        return RolesEnum.SELLER;
      }
      return lower;
    }
    return value;
  })
  @IsIn([RolesEnum.SELLER, RolesEnum.COMPANY_ADMIN], {
    message: 'الدور المطلوب يجب أن يكون seller أو company_admin فقط',
  })
  role: RolesEnum.SELLER | RolesEnum.COMPANY_ADMIN;

  @ApiProperty({
    example: 'Tech Hub Store',
    description: 'Store or company trade name',
  })
  @IsString()
  @IsNotEmpty({ message: 'اسم المتجر أو الكيان التجاري مطلوب' })
  @MinLength(2, { message: 'اسم المتجر يجب ألا يقل عن حرفين' })
  storeName: string;

  @ApiPropertyOptional({
    example: 'Leading electronics & gadget distributor in Egypt',
    description: 'Brief description of the business activity or store',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '123-456-789',
    description:
      'Tax registration number or commercial register number (Required strictly for company_admin)',
  })
  @ValidateIf(
    (o: RegisterSellerAuthDto) =>
      o.role === RolesEnum.COMPANY_ADMIN ||
      (typeof o.role === 'string' &&
        (o.role as string).toLowerCase() === 'company_admin'),
  )
  @IsNotEmpty({ message: 'الرقم الضريبي أو السجل التجاري مطلوب للشركات' })
  @IsString({ message: 'الرقم الضريبي أو السجل التجاري يجب أن يكون نصاً' })
  taxOrCommercialNumber?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/docs/cr_document.pdf',
    description:
      'URL of uploaded commercial registration document (Required strictly for company_admin)',
  })
  @ValidateIf(
    (o: RegisterSellerAuthDto) =>
      o.role === RolesEnum.COMPANY_ADMIN ||
      (typeof o.role === 'string' &&
        (o.role as string).toLowerCase() === 'company_admin'),
  )
  @IsNotEmpty({ message: 'مستند السجل التجاري مطلوب للشركات' })
  @IsString({ message: 'رابط الوثيقة يجب أن يكون نصاً' })
  documentUrl?: string;
}
