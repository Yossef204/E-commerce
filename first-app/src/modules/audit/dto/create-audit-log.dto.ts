import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';
import { AuditActionEnum } from '../../../common/enums/audit-action.enum';

export class CreateAuditLogDto {
  @IsNotEmpty()
  @IsString()
  actorId: string;

  @IsNotEmpty()
  @IsEnum(AuditActionEnum)
  action: AuditActionEnum;

  @IsNotEmpty()
  @IsString()
  targetEntity: string;

  @IsNotEmpty()
  @IsString()
  targetId: string;

  @IsOptional()
  @IsObject()
  previousState?: Record<string, any>;

  @IsOptional()
  @IsObject()
  newState?: Record<string, any>;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
