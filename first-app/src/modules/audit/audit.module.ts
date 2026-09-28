import { Module } from '@nestjs/common';
import { AuditLogMongoModule } from '../../shared/modules/audit-log.mongo.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [AuditLogMongoModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
