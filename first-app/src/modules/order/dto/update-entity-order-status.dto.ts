import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EntityOrderStatusEnum } from '../../../common/enums/entity-order-status.enum';

export class UpdateEntityOrderStatusDto {
  @IsEnum(EntityOrderStatusEnum)
  @IsNotEmpty()
  status: EntityOrderStatusEnum;

  @IsOptional()
  @IsString()
  note?: string;
}
