import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { ALLOW_PENDING_ENTITY_KEY } from '../decorators/allow-pending-entity.decorator';
import { RolesEnum } from '../enums/roles';
import { EntityStatusEnum } from '../enums/entity-status.enum';
import {
  CACHE_SERVICE,
  ICacheService,
} from '../../shared/cache/interfaces/cache-service.interface';

@Injectable()
export class ApprovedEntityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(CACHE_SERVICE)
    private readonly cacheService?: ICacheService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
    @Optional()
    @InjectConnection()
    private readonly connection?: Connection,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Bypass if route is decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 2. Extract request object (HTTP or GraphQL)
    let req = context.switchToHttp().getRequest();
    if (!req) {
      try {
        const gqlContext = GqlExecutionContext.create(context);
        req = gqlContext.getContext()?.req;
      } catch {
        // Not a GraphQL context
      }
    }

    const user = req?.user;
    if (!user) {
      // If authentication guard has not set user, pass through to avoid false positives on unauthenticated routes
      return true;
    }

    // 3. Bypass if user role is NOT a merchant (seller or company_admin)
    const roleLower = (user.role || '').toLowerCase().trim();
    const isSellerRole =
      roleLower === RolesEnum.SELLER.toLowerCase() ||
      roleLower === RolesEnum.COMPANY_ADMIN.toLowerCase() ||
      roleLower === 'seller' ||
      roleLower === 'company_admin';

    if (!isSellerRole) {
      return true;
    }

    // 4. Lookup entityId from user payload
    let entityId: string | null =
      user.sellingEntityId?.toString() ||
      user.entityId?.toString() ||
      null;

    const userId = user.id || user.sub || user._id;

    // Fallback: If entityId not in JWT payload, resolve from database
    if (!entityId && userId && this.connection) {
      try {
        const sellingEntityModel = this.connection.models['SellingEntity'];
        if (sellingEntityModel) {
          const queryConditions: any[] = [];
          if (Types.ObjectId.isValid(userId)) {
            queryConditions.push({ primaryOwnerId: new Types.ObjectId(userId) });
          }
          if (queryConditions.length > 0) {
            const entity = await sellingEntityModel
              .findOne({ $or: queryConditions })
              .select('_id status')
              .lean();
            if (entity) {
              entityId = entity._id ? entity._id.toString() : null;
              if (entityId && !user.sellingEntityId) {
                user.sellingEntityId = entityId;
              }
              if (!user.entityStatus && (entity as any).status) {
                user.entityStatus = (entity as any).status;
              }
            }
          }
        }
      } catch {
        // non-blocking
      }
    }

    if (!entityId) {
      throw new ForbiddenException(
        'حساب التاجر الخاص بك قيد المراجعة والاعتماد. لا يمكنك تنفيذ هذه العملية حتى يتم قبول المتجر.',
      );
    }

    // 5. Retrieve entity status with Redis cache layer (`entity:status:${entityId}`, TTL 300s)
    const cacheKey = `entity:status:${entityId}`;
    let status: string | null = null;

    try {
      if (this.cacheService) {
        status = await this.cacheService.get<string>(cacheKey);
      } else if (this.cacheManager) {
        status = await this.cacheManager.get<string>(cacheKey);
      }
    } catch {
      // non-blocking cache lookup failure
    }

    // Cache miss: query database and populate cache
    if (!status && this.connection) {
      try {
        const sellingEntityModel = this.connection.models['SellingEntity'];
        if (sellingEntityModel && Types.ObjectId.isValid(entityId)) {
          const entity = await sellingEntityModel
            .findById(new Types.ObjectId(entityId))
            .select('status')
            .lean();
          if (entity && (entity as any).status) {
            status = (entity as any).status;
            try {
              if (this.cacheService) {
                await this.cacheService.set(cacheKey, status, 300);
              } else if (this.cacheManager) {
                await this.cacheManager.set(cacheKey, status, 300 * 1000);
              }
            } catch {
              // non-blocking
            }
          }
        }
      } catch {
        // non-blocking
      }
    }

    // Fallback to token payload entityStatus if DB is unreachable
    if (!status && user.entityStatus) {
      status = user.entityStatus;
    }

    const normalizedStatus = (status || '').toUpperCase().trim();

    // 6. If status is APPROVED or ACTIVE -> allow access
    if (
      normalizedStatus === EntityStatusEnum.APPROVED ||
      normalizedStatus === EntityStatusEnum.ACTIVE
    ) {
      return true;
    }

    // 7. If status is PENDING_APPROVAL:
    if (
      normalizedStatus === EntityStatusEnum.PENDING_APPROVAL ||
      !normalizedStatus
    ) {
      const allowPending = this.reflector.getAllAndOverride<boolean>(
        ALLOW_PENDING_ENTITY_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (allowPending) {
        return true;
      }
      throw new ForbiddenException(
        'حساب التاجر الخاص بك قيد المراجعة والاعتماد. لا يمكنك تنفيذ هذه العملية حتى يتم قبول المتجر.',
      );
    }

    // 8. If status is REJECTED, SUSPENDED, or DEACTIVATED -> throw descriptive ForbiddenException
    if (normalizedStatus === EntityStatusEnum.REJECTED) {
      throw new ForbiddenException('تم رفض طلب تسجيل المتجر من قبل الإدارة');
    }

    if (normalizedStatus === 'SUSPENDED') {
      throw new ForbiddenException('حساب التاجر معلق من قبل إدارة المنصة');
    }

    if (normalizedStatus === EntityStatusEnum.DEACTIVATED) {
      throw new ForbiddenException('حساب التاجر معطل من قبل الإدارة');
    }

    throw new ForbiddenException(
      'حساب التاجر الخاص بك قيد المراجعة والاعتماد. لا يمكنك تنفيذ هذه العملية حتى يتم قبول المتجر.',
    );
  }
}

