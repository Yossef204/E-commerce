import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Types } from 'mongoose';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionRepo } from '../../models/permission/permission.repository';
import { UserRepo } from '../../models/user/user.repository';
import {
  CACHE_SERVICE,
  ICacheService,
} from '../../shared/cache/interfaces/cache-service.interface';
import {
  Permission,
  getDefaultPermissionsForRole,
} from '../../common/enums/permissions.enum';
import { RolesEnum } from '../../common/enums/roles';
import { AccountStatusEnum } from '../../common/enums/account-status';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';
import { evaluateSuperAdminStatus } from '../../common/utils/super-admin.policy';
import {
  parseAndValidateTokenVersion,
  syncTokenVersionToCache,
} from '../../common/utils/token-version.util';

export interface IPermissionAuditService {
  logAction(dto: {
    actorId: string;
    action: AuditActionEnum;
    targetEntity: string;
    targetId: string;
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    ipAddress?: string;
  }): Promise<any>;
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly permissionRepo: PermissionRepo,
    @Optional() private readonly userRepo?: UserRepo,
    @Optional()
    @Inject('PERMISSIONS_AUDIT_SERVICE')
    private readonly auditService?: IPermissionAuditService,
    @Optional()
    @Inject(CACHE_SERVICE)
    private readonly cacheService?: ICacheService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {}

  /**
   * إلغاء صلاحية الـ tokenVersion لمستخدم في الـ Cache لضمان إنهاء الجلسات فور تعديل الصلاحيات
   */
  private async invalidateTokenVersion(
    userId: string | Types.ObjectId,
  ): Promise<void> {
    if (!userId) return;
    const idStr = userId.toString();
    try {
      let authoritativeVersion: number;

      // 1. Atomically increment tokenVersion in authoritative MongoDB User document
      if (this.userRepo && Types.ObjectId.isValid(idStr)) {
        const updatedUser = await this.userRepo.updateOne(
          { _id: new Types.ObjectId(idStr) },
          { $inc: { tokenVersion: 1 } },
          { new: true },
        );
        if (updatedUser && (updatedUser as any).tokenVersion !== undefined) {
          authoritativeVersion = parseAndValidateTokenVersion((updatedUser as any).tokenVersion);
        } else {
          const u = await this.userRepo.getOne({ _id: new Types.ObjectId(idStr) });
          authoritativeVersion = parseAndValidateTokenVersion((u as any)?.tokenVersion);
        }
      } else {
        authoritativeVersion = 1;
      }

      // 2. Synchronize single canonical version across cache layers (no double increment!)
      const cacheTarget = this.cacheService || this.cacheManager;
      if (cacheTarget) {
        await syncTokenVersionToCache(cacheTarget, idStr, authoritativeVersion);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to invalidate tokenVersion for user ${idStr}: ${err?.message}`);
    }
  }

  /**
   * التحقق الموثق من كون المستخدم يمتلك صلاحية السوبر أدمن عبر قاعدة البيانات حصراً
   */
  private async isSuperAdmin(actorId: string, currentUser?: any): Promise<boolean> {
    if (!actorId) return false;

    if (!this.userRepo) {
      const role = (currentUser?.role || '').toLowerCase();
      const perms = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
      return (
        role === 'super_admin' ||
        role === 'superadmin' ||
        perms.includes(Permission.PLATFORM_SUPER_ADMIN)
      );
    }

    if (!Types.ObjectId.isValid(actorId)) return false;

    const actor = await this.userRepo.getOne({ _id: new Types.ObjectId(actorId) });
    const permDoc = await this.permissionRepo.getOne({ userId: new Types.ObjectId(actorId) });

    const evalResult = await evaluateSuperAdminStatus(actorId, undefined, actor, permDoc);
    return evalResult.isSuperAdmin;
  }

  /**
   * تطبيق هرمية الصلاحيات ومنع التصعيد الذاتي أو منح صلاحيات خارج نطاق التفويض
   */
  private async validatePermissionDelegation(
    actorId: string,
    targetUserId: string,
    requestedPermissions: string[],
    isActorSuperAdmin: boolean,
    action: 'create' | 'update' | 'delete',
    existingTargetPermissions: string[] = [],
  ): Promise<void> {
    // 1. منع التصعيد الذاتي أو تعديل المستخدم لصلاحياته بنفسه
    if (actorId.toString() === targetUserId.toString()) {
      throw new ForbiddenException('Self-modification of permissions is strictly prohibited');
    }

    if (this.userRepo) {
      const targetUser = await this.userRepo.getOne({ _id: new Types.ObjectId(targetUserId) });
      if (!targetUser) {
        throw new NotFoundException(`Target user #${targetUserId} not found`);
      }

      // 2. حماية حسابات السوبر أدمن من التعديل أو الحذف من قبل الموظفين العاديين
      const targetRoleLower = (targetUser.role || '').toLowerCase();
      const targetUserPerms: string[] = Array.isArray((targetUser as any)?.permissions)
        ? (targetUser as any).permissions
        : [];
      const isTargetSuperAdmin =
        targetRoleLower === RolesEnum.SUPER_ADMIN.toLowerCase() ||
        targetRoleLower === 'superadmin' ||
        targetUserPerms.includes(Permission.PLATFORM_SUPER_ADMIN) ||
        existingTargetPermissions.includes(Permission.PLATFORM_SUPER_ADMIN) ||
        (await this.isSuperAdmin(targetUserId));

      if (isTargetSuperAdmin && !isActorSuperAdmin) {
        throw new ForbiddenException(
          'Only verified Super Admins may modify or delete permissions of a Super Admin account',
        );
      }

      // 3. قيود الموظف العادي
      if (!isActorSuperAdmin) {
        // 3.1 منع منح صلاحية السوبر أدمن السيادية
        if (requestedPermissions.includes(Permission.PLATFORM_SUPER_ADMIN)) {
          throw new ForbiddenException(
            'Only verified Super Admins can grant platform.super_admin privilege',
          );
        }

        // 3.2 قيد نطاق التفويض: لا يمكن للموظف منح صلاحية لا يمتلكها هو شخصياً
        const actorPermDoc = await this.permissionRepo.getOne({ userId: new Types.ObjectId(actorId) });
        const actorUser = await this.userRepo.getOne({ _id: new Types.ObjectId(actorId) });
        const actorRole = actorUser?.role || RolesEnum.CUSTOMER;
        const defaultRolePerms = (getDefaultPermissionsForRole(actorRole) as string[]) || [];

        const actorEffectivePermissions = new Set<string>([
          ...(actorPermDoc?.permissions || []),
          ...defaultRolePerms,
        ]);

        const unauthorized = requestedPermissions.filter((p) => !actorEffectivePermissions.has(p));
        if (unauthorized.length > 0) {
          throw new ForbiddenException(
            `Cannot grant permissions outside your authorized delegation scope: ${unauthorized.join(', ')}`,
          );
        }

        // 3.3 عزل الكيانات (Tenant Isolation): إذا كان الفاعل تابعاً لمتجر/شركة، يمنع تعديل مستخدم خارجها
        if (actorUser?.sellingEntityId) {
          if (
            !targetUser.sellingEntityId ||
            targetUser.sellingEntityId.toString() !== actorUser.sellingEntityId.toString()
          ) {
            throw new ForbiddenException(
              'Cannot manage permissions for users outside your organization or store',
            );
          }
        }
      }
    } else {
      if (!isActorSuperAdmin && requestedPermissions.includes(Permission.PLATFORM_SUPER_ADMIN)) {
        throw new ForbiddenException(
          'Only verified Super Admins can grant platform.super_admin privilege',
        );
      }
    }
  }

  // تعيين أو تحديث الصلاحيات لمستخدم محدد (Upsert)
  async create(createPermissionDto: CreatePermissionDto, currentUser?: any) {
    if (!createPermissionDto.userId || !Types.ObjectId.isValid(createPermissionDto.userId)) {
      throw new BadRequestException('Invalid User ID format');
    }

    const actorId = currentUser?.sub || currentUser?.id;
    if (actorId) {
      const isSuper = await this.isSuperAdmin(actorId, currentUser);
      await this.validatePermissionDelegation(
        actorId,
        createPermissionDto.userId,
        createPermissionDto.permissions || [],
        isSuper,
        'create',
      );
    }

    const result = await this.permissionRepo.upsertUserPermissions(
      createPermissionDto.userId,
      createPermissionDto.permissions,
    );
    await this.invalidateTokenVersion(createPermissionDto.userId);

    if (actorId && this.auditService) {
      try {
        await this.auditService.logAction({
          actorId,
          action: AuditActionEnum.PERMISSION_CHANGE,
          targetEntity: 'Permission',
          targetId: createPermissionDto.userId,
          newState: { permissions: createPermissionDto.permissions },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to log audit event: ${err?.message}`);
      }
    }

    return result;
  }

  // جلب كل سجلات الصلاحيات
  async findAll() {
    return this.permissionRepo.getAll({});
  }

  // جلب الصلاحيات لمستخدم عبر الـ userId
  async findByUserId(userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID format');
    }

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
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Permission ID format');
    }

    const permission = await this.permissionRepo.getOne({
      _id: new Types.ObjectId(id),
    });

    if (!permission) {
      throw new NotFoundException(`Permission record #${id} not found`);
    }

    return permission;
  }

  // تحديث السجل
  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
    currentUser?: any,
  ) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Permission ID format');
    }

    if (updatePermissionDto.userId && !Types.ObjectId.isValid(updatePermissionDto.userId)) {
      throw new BadRequestException('Invalid User ID format');
    }

    let existing: any = null;
    const actorId = currentUser?.sub || currentUser?.id;
    if (actorId) {
      existing = await this.permissionRepo.getOne({
        _id: new Types.ObjectId(id),
      });

      if (!existing) {
        throw new NotFoundException(`Permission record #${id} not found`);
      }

      const targetUserId =
        updatePermissionDto.userId ||
        ((existing as any).userId ? (existing as any).userId.toString() : null);

      if (targetUserId) {
        const isSuper = await this.isSuperAdmin(actorId, currentUser);
        await this.validatePermissionDelegation(
          actorId,
          targetUserId,
          updatePermissionDto.permissions || [],
          isSuper,
          'update',
          existing.permissions || [],
        );
      }
    }

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

    if (actorId && this.auditService) {
      try {
        await this.auditService.logAction({
          actorId,
          action: AuditActionEnum.PERMISSION_CHANGE,
          targetEntity: 'Permission',
          targetId: id,
          previousState: { permissions: existing?.permissions || [] },
          newState: { permissions: updatePermissionDto.permissions || [] },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to log audit event: ${err?.message}`);
      }
    }

    return updated;
  }

  // حذف السجل
  async remove(id: string, currentUser?: any) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Permission ID format');
    }

    const existing = await this.permissionRepo.getOne({
      _id: new Types.ObjectId(id),
    });

    if (!existing) {
      throw new NotFoundException(`Permission record #${id} not found`);
    }

    const actorId = currentUser?.sub || currentUser?.id;
    if (actorId && existing.userId) {
      const isSuper = await this.isSuperAdmin(actorId, currentUser);
      await this.validatePermissionDelegation(
        actorId,
        existing.userId.toString(),
        [],
        isSuper,
        'delete',
        existing.permissions || [],
      );
    }

    const deleted = await this.permissionRepo.deleteOne({
      _id: new Types.ObjectId(id),
    });

    if (!deleted) {
      throw new NotFoundException(`Permission record #${id} not found`);
    }

    if (existing.userId) {
      await this.invalidateTokenVersion(existing.userId);
    }

    if (actorId && this.auditService) {
      try {
        await this.auditService.logAction({
          actorId,
          action: AuditActionEnum.PERMISSION_CHANGE,
          targetEntity: 'Permission',
          targetId: id,
          previousState: { permissions: existing.permissions || [] },
          newState: { status: 'DELETED' },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to log audit event: ${err?.message}`);
      }
    }

    return {
      success: true,
      message: `Permission record #${id} deleted successfully`,
    };
  }
}
