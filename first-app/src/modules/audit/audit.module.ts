import { Global, Module } from '@nestjs/common';
import { AuditLogMongoModule } from '../../shared/modules/audit-log.mongo.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';

@Global()
@Module({
  imports: [AuditLogMongoModule],
  controllers: [AuditController],
  providers: [AuditService, AuditLogInterceptor],
  exports: [AuditService, AuditLogInterceptor],
})
export class AuditModule {}
