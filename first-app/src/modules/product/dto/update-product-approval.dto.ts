import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProductApprovalStatusEnum } from '../../../common/enums/product-approval-status.enum';

export class UpdateProductApprovalDto {
  @IsEnum(ProductApprovalStatusEnum)
  @IsNotEmpty()
  approvalStatus: ProductApprovalStatusEnum;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
