import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionRepo } from '../../models/permission/permission.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionRepo: PermissionRepo) {}

  // تعيين أو تحديث الصلاحيات لمستخدم محدد (Upsert)
  async create(createPermissionDto: CreatePermissionDto) {
    return this.permissionRepo.upsertUserPermissions(
      createPermissionDto.userId,
      createPermissionDto.permissions,
    );
  }

  // جلب كل سجلات الصلاحيات
  async findAll() {
    return this.permissionRepo.getAll({});
  }

  // جلب الصلاحيات لمستخدم عبر الـ userId
  async findByUserId(userId: string) {
    const permission = await this.permissionRepo.getOne({
      userId: new Types.ObjectId(userId),
    });

    if (!permission) {
      throw new NotFoundException(`Permissions for user #${userId} not found`);
    }

    return permission;
  }

  // جلب السجل عبر الـ _id الخاص بالـ Document
  async findOne(id: string) {
    const permission = await this.permissionRepo.getOne({
      _id: new Types.ObjectId(id),
    });

    if (!permission) {
      throw new NotFoundException(`Permission record #${id} not found`);
    }

    return permission;
  }

  // تحديث السجل
  async update(id: string, updatePermissionDto: UpdatePermissionDto) {
    const updateData: Record<string, any> = { ...updatePermissionDto };

    if (updatePermissionDto.userId) {
      updateData.userId = new Types.ObjectId(updatePermissionDto.userId);
    }

    const updated = await this.permissionRepo.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: updateData },
    );

    if (!updated) {
      throw new NotFoundException(`Permission record #${id} not found`);
    }

    return updated;
  }

  // حذف السجل
  async remove(id: string) {
    const deleted = await this.permissionRepo.deleteOne({
      _id: new Types.ObjectId(id),
    });

    if (!deleted) {
      throw new NotFoundException(`Permission record #${id} not found`);
    }

    return {
      success: true,
      message: `Permission record #${id} deleted successfully`,
    };
  }
}
