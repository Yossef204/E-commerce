import {
  Injectable,
  NotFoundException,
  Inject,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Types } from 'mongoose';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionRepo } from '../../models/permission/permission.repository';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissionRepo: PermissionRepo,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  private async invalidateTokenVersion(
    userId: string | Types.ObjectId,
  ): Promise<void> {
    if (!this.cacheManager || !userId) return;
    try {
      const key = `auth:token_version:${userId.toString()}`;
      const store = (this.cacheManager as any)?.store;
      if (store?.client?.incr) {
        await store.client.incr(key);
      } else {
        const current =
          (await this.cacheManager.get<number | string>(key)) || 1;
        await this.cacheManager.set(key, Number(current) + 1);
      }
    } catch {
      // non-blocking
    }
  }

  // تعيين أو تحديث الصلاحيات لمستخدم محدد (Upsert)
  async create(createPermissionDto: CreatePermissionDto) {
    const result = await this.permissionRepo.upsertUserPermissions(
      createPermissionDto.userId,
      createPermissionDto.permissions,
    );
    await this.invalidateTokenVersion(createPermissionDto.userId);
    return result;
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

    const targetUserId =
      updatePermissionDto.userId ||
      ((updated as any).userId ? (updated as any).userId.toString() : null);
    if (targetUserId) {
      await this.invalidateTokenVersion(targetUserId);
    }

    return updated;
  }

  // حذف السجل
  async remove(id: string) {
    const existing = await this.permissionRepo.getOne({
      _id: new Types.ObjectId(id),
    });

    const deleted = await this.permissionRepo.deleteOne({
      _id: new Types.ObjectId(id),
    });

    if (!deleted) {
      throw new NotFoundException(`Permission record #${id} not found`);
    }

    if (existing?.userId) {
      await this.invalidateTokenVersion(existing.userId);
    }

    return {
      success: true,
      message: `Permission record #${id} deleted successfully`,
    };
  }
}
