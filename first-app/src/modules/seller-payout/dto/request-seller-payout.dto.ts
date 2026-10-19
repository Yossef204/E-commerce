import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RequestSellerPayoutDto {
  @IsOptional()
  @IsString()
  sellingEntityId?: string;

  @IsNotEmpty({ message: 'المبلغ المطلوب سحبه إلزامي' })
  @Type(() => Number)
  @IsNumber({}, { message: 'المبلغ يجب أن يكون رقماً صحيحاً أو عشرياً' })
  @Min(500, { message: 'الحد الأدنى لطلب سحب الأرباح هو 500 ج.م' })
  amount: number;

  @IsNotEmpty({ message: 'يرجى اختيار وسيلة سحب صالحة' })
  @IsString({ message: 'معرف وسيلة السحب غير صالح' })
  payoutMethodId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

