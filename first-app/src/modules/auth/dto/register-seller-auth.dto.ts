import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
  MinLength,
  IsIn,
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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
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
    example: 'COMPANY',
    enum: ['COMPANY', 'INDEPENDENT_SELLER'],
    description: 'Type of business entity (COMPANY or INDEPENDENT_SELLER)',
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiProperty({
    example: '123-456-789',
    description: 'Tax registration number or commercial register number',
  })
  @IsString()
  @IsNotEmpty({ message: 'الرقم الضريبي أو السجل التجاري مطلوب' })
  taxOrCommercialNumber: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/docs/cr_document.pdf',
    description: 'URL of uploaded commercial registration or ID document',
  })
  @IsOptional()
  @IsString()
  documentUrl?: string;
}

