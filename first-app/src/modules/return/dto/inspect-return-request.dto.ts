import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  ReturnStatusEnum,
  InspectionResultEnum,
} from '../../../common/enums/return-status.enum';

export class InspectReturnRequestDto {
  @IsEnum(ReturnStatusEnum)
  status: ReturnStatusEnum;

  @IsOptional()
  @IsEnum(InspectionResultEnum)
  inspectionResult?: InspectionResultEnum;

  @IsOptional()
  @IsString()
  vendorNote?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

