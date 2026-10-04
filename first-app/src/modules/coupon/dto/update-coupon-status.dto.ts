import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateCouponStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
