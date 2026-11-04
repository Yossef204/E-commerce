import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'NewSecurePassword@123!',
    description:
      'كلمة المرور الجديدة (يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص، وألا تقل عن 8 أحرف)',
    minLength: 8,
  })
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @IsNotEmpty({ message: 'كلمة المرور الجديدة مطلوبة' })
  @MinLength(8, { message: 'يجب ألا تقل كلمة المرور عن 8 أحرف أو أرقام' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$/,
    {
      message:
        'يجب أن تحتوي كلمة المرور على حرف كبير، وحرف صغير، ورقم، ورمز خاص واحد على الأقل',
    },
  )
  newPassword: string;
}
