import { SetMetadata } from '@nestjs/common';
import { AuditActionEnum } from '../enums/audit-action.enum';

export const AUDITABLE_KEY = 'AUDITABLE_METADATA_KEY';

export interface AuditableOptions {
  targetEntity: string;
  action: AuditActionEnum | string;
  targetIdExtractor?: (req: any, resData?: any) => string;
}

export const Auditable = (options: AuditableOptions) =>
  SetMetadata(AUDITABLE_KEY, options);

