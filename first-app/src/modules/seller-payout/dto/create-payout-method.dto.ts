import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsBoolean,
  IsString,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayoutMethodTypeEnum } from '../../../models/payout/seller-payout-method.schema';

export class BankAccountDetailsDto {
  @IsNotEmpty({ message: 'اسم صاحب الحساب البنكي مطلوب' })
  @IsString()
  accountHolderName: string;

  @IsNotEmpty({ message: 'اسم البنك مطلوب' })
  @IsString()
  bankName: string;

  @IsNotEmpty({ message: 'رقم الحساب الدولي (IBAN) مطلوب' })
  @IsString()
  iban: string;

  @IsOptional()
  @IsString()
  swiftCode?: string;
}

export class MobileWalletDetailsDto {
  @IsNotEmpty({ message: 'رقم المحفظة الإلكترونية مطلوب' })
  @Matches(/^01[0125][0-9]{8}$/, {
    message: 'رقم المحفظة يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015',
  })
  walletNumber: string;
}

export class InstaPayDetailsDto {
  @IsNotEmpty({ message: 'عنوان أو رقم إنستاباي مطلوب' })
  @IsString()
  instaPayAddress: string;
}

export class CreatePayoutMethodDto {
  @IsOptional()
  @IsString()
  sellingEntityId?: string;

  @IsNotEmpty({ message: 'نوع طريقة السحب مطلوب' })
  @IsEnum(PayoutMethodTypeEnum, {
    message: 'نوع طريقة السحب يجب أن يكون BANK_ACCOUNT أو VODAFONE_CASH أو INSTAPAY',
  })
  type: PayoutMethodTypeEnum;

  @IsNotEmpty({ message: 'بيانات وسيلة السحب مطلوبة' })
  @IsObject()
  details: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
