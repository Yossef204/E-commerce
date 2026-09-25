import { Types } from 'mongoose';
import { AuditActionEnum } from '../enums/audit-action.enum';

export interface IAuditLog {
  _id?: Types.ObjectId;
  actorId: Types.ObjectId;
  action: AuditActionEnum;
  targetEntity: string;
  targetId: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  ipAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

