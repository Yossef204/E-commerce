// permission.repository.ts (تحديث أو إضافة)
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { IPermission, Permission } from './permission.schema';

@Injectable()
export class PermissionRepo extends AbstractRepo<IPermission> {
  constructor(
    @InjectModel(Permission.name)
    permissionModel: Model<IPermission>,
  ) {
    super(permissionModel);
  }

  // الحل الأسهل: إعادة استخدام updateOne من الـ AbstractRepo
  async upsertUserPermissions(
    userId: string,
    permissions: string[],
  ): Promise<IPermission | null> {
    return this.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { permissions } },
      { upsert: true },
    );
  }
}
