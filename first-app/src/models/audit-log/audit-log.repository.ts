import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { AuditLog, TAuditLog } from './audit-log.schema';

@Injectable()
export class AuditLogRepo extends AbstractRepo<TAuditLog> {
  constructor(@InjectModel(AuditLog.name) auditLogModel: Model<TAuditLog>) {
    super(auditLogModel);
  }
}
