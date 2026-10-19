import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'الاسم يجب أن يكون نصاً' })
  @MinLength(2, { message: 'يجب ألا يقل الاسم عن حرفين' })
  userName?: string;

  @IsOptional()
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصاً' })
  phoneNumber?: string;

  @IsOptional()
  @IsString({ message: 'العنوان يجب أن يكون نصاً' })
  address?: string;

  @IsOptional()
  @IsArray({ message: 'قائمة العناوين يجب أن تكون مصفوفة' })
  @IsString({ each: true, message: 'كل عنوان يجب أن يكون نصاً' })
  addresses?: string[];
}

