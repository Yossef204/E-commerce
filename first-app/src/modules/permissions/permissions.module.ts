import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionRepo } from '../../models/permission/permission.repository';
import {
  Permission,
  permissionSchema,
} from '../../models/permission/permission.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Permission.name, schema: permissionSchema },
    ]),
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionRepo],
  exports: [PermissionsService, PermissionRepo],
})
export class PermissionsModule {}
