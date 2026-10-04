import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProductApprovalStatusEnum } from '../../../common/enums/product-approval-status.enum';

export class UpdateApprovalDto {
  @IsEnum(ProductApprovalStatusEnum)
  @IsNotEmpty()
  approvalStatus: ProductApprovalStatusEnum;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
