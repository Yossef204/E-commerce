import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentMethodEnum } from '../../../common/enums/payment-method.enum';

export class ProcessPaymentDto {
  @IsNotEmpty()
  @IsString()
  mainOrderId: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsNotEmpty()
  @IsString()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  gatewayToken?: string;
}

