import { AuditActionEnum } from '../enums/audit-action.enum';

export class AuditLogEvent {
  constructor(
    public readonly actorId: string,
    public readonly action: AuditActionEnum,
    public readonly targetEntity: string,
    public readonly targetId: string,
    public readonly previousState?: Record<string, any>,
    public readonly newState?: Record<string, any>,
    public readonly ipAddress?: string,
  ) {}
}

