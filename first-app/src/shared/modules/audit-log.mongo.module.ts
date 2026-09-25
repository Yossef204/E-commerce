import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../../models/audit-log/audit-log.schema';
import { AuditLogRepo } from '../../models/audit-log/audit-log.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  providers: [AuditLogRepo],
  exports: [AuditLogRepo],
})
export class AuditLogMongoModule {}

