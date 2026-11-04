import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  CACHE_SERVICE,
  ICacheService,
} from '../../../shared/cache/interfaces/cache-service.interface';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../../models/user/user.repository';
import { BrandRepo } from '../../../models/brand/brand.repository';
import { EntityStatusEnum } from '../../../common/enums/entity-status.enum';
import {
  parseAndValidateTokenVersion,
  syncTokenVersionToCache,
} from '../../../common/utils/token-version.util';

@Injectable()
export class AdminSellerService {
  constructor(
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly userRepo: UserRepo,
    private readonly brandRepo: BrandRepo,
    @InjectConnection() private readonly connection: Connection,
    @Optional()
    @Inject(CACHE_SERVICE)
    private readonly cacheService?: ICacheService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {}

  /**
   * Delete entity status from cache
   */
  async invalidateEntityCache(entityId: string | Types.ObjectId): Promise<void> {
    if (!entityId) return;
    const key = `entity:status:${entityId.toString()}`;
    try {
      if (this.cacheService) {
        await this.cacheService.del(key);
      }
      if (this.cacheManager) {
        await this.cacheManager.del(key);
      }
    } catch {
      // non-blocking
    }
  }

  /**
   * Increment tokenVersion in Redis cache and Mongo DB for user to revoke active JWTs
   */
  async incrementUserTokenVersion(userId: string | Types.ObjectId): Promise<void> {
    if (!userId) return;
    const userIdStr = userId.toString();

    try {
      let authoritativeVersion = 1;

      // 1. Atomically increment tokenVersion in authoritative MongoDB User document first
      if (this.userRepo && Types.ObjectId.isValid(userIdStr)) {
        const updatedUser = await this.userRepo.updateOne(
          { _id: new Types.ObjectId(userIdStr) },
          { $inc: { tokenVersion: 1 } },
          { new: true },
        );
        if (updatedUser && (updatedUser as any).tokenVersion !== undefined) {
          authoritativeVersion = parseAndValidateTokenVersion((updatedUser as any).tokenVersion);
        } else {
          const u = await this.userRepo.getOne({ _id: new Types.ObjectId(userIdStr) });
          authoritativeVersion = parseAndValidateTokenVersion((u as any)?.tokenVersion);
        }
      }

      // 2. Synchronize single canonical version across cache layers
      const cacheTarget = this.cacheService || this.cacheManager;
      if (cacheTarget) {
        await syncTokenVersionToCache(cacheTarget, userIdStr, authoritativeVersion);
      }
    } catch {
      // non-blocking
    }
  }

  /**
   * Approve seller entity
   */
  async approveEntity(entityIdStr: string) {
    return this.updateEntityStatus(entityIdStr, EntityStatusEnum.APPROVED);
  }

  /**
   * Reject seller entity
   */
  async rejectEntity(entityIdStr: string, rejectionReason?: string) {
    return this.updateEntityStatus(
      entityIdStr,
      EntityStatusEnum.REJECTED,
      rejectionReason,
    );
  }

  /**
   * Deactivate seller entity
   */
  async deactivateEntity(entityIdStr: string, reason?: string) {
    return this.updateEntityStatus(
      entityIdStr,
      EntityStatusEnum.DEACTIVATED,
      reason,
    );
  }

  /**
   * Central method: updates status, invalidates cache key entity:status:${entityId},
   * and increments tokenVersion for all associated users.
   */
  async updateEntityStatus(
    entityIdStr: string,
    status: EntityStatusEnum,
    rejectionReason?: string,
  ) {
    if (!Types.ObjectId.isValid(entityIdStr)) {
      throw new BadRequestException('Invalid entity ID format');
    }
    const entityId = new Types.ObjectId(entityIdStr);
    const entity = await this.sellingEntityRepo.getOne({ _id: entityId });
    if (!entity) {
      throw new NotFoundException('Selling entity not found');
    }

    const updatedEntity = await this.sellingEntityRepo.updateOne(
      { _id: entityId },
      {
        status,
        rejectionReason:
          status === EntityStatusEnum.REJECTED
            ? rejectionReason || 'تم رفض طلب التسجيل من قبل إدارة المنصة'
            : undefined,
      },
    );

    // 1. Delete cache key entity:status:${entityId}
    await this.invalidateEntityCache(entityId);

    // 2. Synchronize brand active status
    const isApprovedOrActive =
      status === EntityStatusEnum.APPROVED || status === EntityStatusEnum.ACTIVE;
    await this.brandRepo.updateMany(
      { sellingEntityId: entityId },
      { isActive: isApprovedOrActive },
    );

    // 3. Increment tokenVersion for all associated users
    const associatedUsers: (Types.ObjectId | string)[] = [];
    if (entity.primaryOwnerId) {
      associatedUsers.push(entity.primaryOwnerId);
    }
    try {
      const users = await this.userRepo.getAll({ sellingEntityId: entityId } as any);
      for (const u of users) {
        if (
          u._id &&
          !associatedUsers.some((id) => id.toString() === u._id!.toString())
        ) {
          associatedUsers.push(u._id);
        }
      }
    } catch {
      // non-blocking
    }

    for (const uid of associatedUsers) {
      await this.incrementUserTokenVersion(uid);
    }

    return {
      success: true,
      message: `Entity status updated to ${status}`,
      data: updatedEntity,
    };
  }
}

