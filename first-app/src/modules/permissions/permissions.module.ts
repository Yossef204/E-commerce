import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionRepo } from '../../models/permission/permission.repository';
import {
  Permission,
  permissionSchema,
} from '../../models/permission/permission.schema';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { CustomCacheModule } from '../../shared/cache/custom-cache.module';
import { AuditModule } from '../audit/audit.module';

import { AuditService } from '../audit/audit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Permission.name, schema: permissionSchema },
    ]),
    UserMongoModule,
    CustomCacheModule,
    AuditModule,
  ],
  controllers: [PermissionsController],
  providers: [
    PermissionsService,
    PermissionRepo,
    {
      provide: 'PERMISSIONS_AUDIT_SERVICE',
      useExisting: AuditService,
    },
  ],
  exports: [PermissionsService, PermissionRepo],
})
export class PermissionsModule {}
