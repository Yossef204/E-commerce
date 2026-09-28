import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EntityStatusEnum } from '../../../common/enums/entity-status.enum';

export class UpdateEntityStatusDto {
  @IsEnum(EntityStatusEnum)
  @IsNotEmpty()
  status: EntityStatusEnum;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
