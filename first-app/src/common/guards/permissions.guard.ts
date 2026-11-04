import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  Permission,
  PermissionEnum,
  getDefaultPermissionsForRole,
  DEFAULT_SUPER_ADMIN_PERMISSIONS,
} from '../enums/permissions.enum';
import { RolesEnum } from '../enums/roles';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { ALLOW_PENDING_ENTITY_KEY } from '../decorators/allow-pending-entity.decorator';
import { evaluateSuperAdminStatus } from '../utils/super-admin.policy';

// Bidirectional equivalence mappings for canonical permissions and legacy variants
const CANONICAL_EQUIVALENCES: Record<string, string[]> = {
  [Permission.PRODUCT_READ]: ['products.read', 'products.read_own', 'products.read_all'],
  [Permission.PRODUCT_CREATE]: ['products.create'],
  [Permission.PRODUCT_UPDATE]: ['products.update', 'products.update_own', 'product.update_entity'],
  [Permission.PRODUCT_DELETE]: ['products.delete', 'products.delete_own', 'product.delete_entity'],
  [Permission.PRODUCT_APPROVE]: ['products.approve'],
  [Permission.INVENTORY_UPDATE]: ['inventory.update', 'inventory.manage', 'inventory.manage_own', 'inventory.manage_entity'],
  [Permission.ORDER_READ_OWN]: ['orders.read_own', 'order.read_own'],
  [Permission.ORDER_READ_ENTITY]: ['orders.seller_read', 'order.read_entity'],
  [Permission.ORDER_READ_ALL]: ['orders.read_all', 'order.read_all'],
  [Permission.ORDER_UPDATE_STATUS]: ['orders.status_update', 'order.update_status', 'order.update_entity_status'],
  [Permission.ORDER_CANCEL]: ['orders.cancel_own', 'order.cancel', 'order.cancel_own'],
  [Permission.ORDER_CANCEL_OWN]: ['orders.cancel_own', 'order.cancel', 'order.cancel_own'],
  [Permission.RETURN_READ]: ['return.read', 'returns.read', 'return.read_own', 'return.read_entity'],
  [Permission.RETURN_READ_OWN]: ['return.read_own', 'returns.read'],
  [Permission.RETURN_READ_ENTITY]: ['return.read_entity', 'return.read', 'returns.read'],
  [Permission.RETURN_INSPECT]: ['return.inspect'],
  [Permission.REFUND_APPROVE]: ['refund.approve'],
  [Permission.REFUND_EXECUTE]: ['refund.execute'],
  [Permission.PROFILE_READ_OWN]: ['profile.read_own', 'profile.read'],
  [Permission.PROFILE_UPDATE_OWN]: ['profile.update_own', 'profile.update', 'profile.manage'],
  [Permission.PROFILE_READ]: ['profile.read', 'profile.read_own'],
  [Permission.PROFILE_UPDATE]: ['profile.update', 'profile.update_own', 'profile.manage'],
  [Permission.SELLING_ENTITY_READ]: ['selling_entity.read', 'company.read', 'selling_entity.read_all', 'selling_entity.read_own'],
  [Permission.SELLING_ENTITY_READ_OWN]: ['selling_entity.read_own', 'selling_entity.read', 'company.read'],
  [Permission.SELLING_ENTITY_READ_ALL]: ['selling_entity.read_all', 'selling_entity.read', 'company.read'],
  [Permission.SELLING_ENTITY_UPDATE_OWN]: ['company.profile_update', 'entity.manage', 'company.update', 'selling_entity.update_own'],
  [Permission.SELLING_ENTITY_APPROVE]: ['selling_entity.approve', 'company.approve'],
  [Permission.SELLING_ENTITY_SUSPEND]: ['selling_entity.suspend', 'seller.manage'],
  [Permission.LEDGER_READ]: ['escrow.manage', 'analytics.read', 'ledger.read'],
  [Permission.WALLET_READ_OWN]: ['wallet.read_own', 'ledger.read', 'analytics.read_own'],
  [Permission.PAYOUT_READ]: ['analytics.read', 'analytics.read_own', 'payout.read', 'payout.read_own', 'payout.read_all', 'payout.read_entity'],
  [Permission.PAYOUT_READ_OWN]: ['payout.read_own', 'payout.read', 'analytics.read_own', 'payout.read_entity'],
  [Permission.PAYOUT_READ_ALL]: ['payout.read_all', 'payout.read', 'analytics.read'],
  [Permission.PAYOUT_REQUEST]: ['payout.request'],
  [Permission.PAYOUT_PROCESS]: ['payout.process', 'payout.approve'],
  [Permission.COMMISSION_MANAGE]: ['commissions.manage', 'commission.manage'],
  [Permission.USER_MANAGE]: ['user.manage', 'entity.users_manage'],
  [Permission.CATEGORY_MANAGE]: ['category.manage'],
  [Permission.BRAND_MANAGE]: [
    'brand.manage',
    'brand.manage_all',
    'brand.manage.all',
    'brand.create.own',
    'brand.update.own',
    'brand.delete.own',
  ],
  [Permission.BRAND_MANAGE_ALL]: ['brand.manage.all', 'brand.manage_all', 'brand.manage'],
  [Permission.BRAND_CREATE_OWN]: ['brand.create.own', 'brand.manage', 'brand.manage.all'],
  [Permission.BRAND_UPDATE_OWN]: ['brand.update.own', 'brand.manage', 'brand.manage.all'],
  [Permission.BRAND_DELETE_OWN]: ['brand.delete.own', 'brand.manage', 'brand.manage.all'],
  [Permission.SETTINGS_MANAGE]: ['settings.manage'],
  [Permission.REVIEW_CREATE]: ['reviews.create'],
  [Permission.REVIEW_MODERATE]: ['review.moderate'],
  [Permission.AUDIT_LOG_READ]: ['audit_logs.read', 'audit_log.read'],
  [Permission.COUPON_MANAGE_OWN]: ['coupons.manage_own'],
  [Permission.COUPON_MANAGE_GLOBAL]: ['coupons.manage_global'],
};

// Actions permitted for merchant accounts before administrative verification
const PERMITTED_PRE_APPROVAL_PERMISSIONS = new Set<string>([
  Permission.PROFILE_READ_OWN,
  Permission.PROFILE_UPDATE_OWN,
  Permission.PROFILE_READ,
  Permission.PROFILE_UPDATE,
  Permission.SELLING_ENTITY_READ_OWN,
  Permission.SELLING_ENTITY_READ,
  Permission.CART_MANAGE,
  Permission.ORDER_CREATE,
  Permission.ORDER_READ_OWN,
  Permission.REVIEW_READ,
  Permission.FILE_UPLOAD,
  'profile.read_own',
  'profile.update_own',
  'profile.read',
  'profile.update',
  'selling_entity.read_own',
  'cart.manage',
  'orders.read_own',
  'orders.create',
]);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly jwtService?: JwtService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() @InjectConnection() private readonly connection?: Connection,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions =
      this.reflector.getAllAndOverride<(PermissionEnum | Permission | string)[]>(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

    // If endpoint is public and requires no permissions, pass immediately
    if (isPublic && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    // If no permissions are required, pass
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Extract request from HTTP or GraphQL context
    let req = context.switchToHttp().getRequest();
    if (!req) {
      const gqlContext = GqlExecutionContext.create(context);
      req = gqlContext.getContext()?.req;
    }

    let user = req?.user;

    // Cryptographic fallback verification ONLY if user was not already set by AuthenticationGuard
    if (!user && req?.headers?.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      if (token && this.jwtService) {
        try {
          const jwtSecret =
            this.configService?.get<string>('JWT_SECRET') ||
            this.configService?.get<any>('jwt')?.accessSecret ||
            process.env.ACCESS_TOKEN_SECRET ||
            'fallback_super_secret_key_123';

          user = await this.jwtService.verifyAsync(token, {
            secret: jwtSecret,
          });
          if (req) req.user = user;
        } catch {
          throw new UnauthorizedException('Invalid or expired authentication token');
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const userId = user.id || user.sub || user._id;
    if (!userId) {
      throw new UnauthorizedException('Invalid user credentials');
    }

    // 1. Authoritative Server-Side Account & Super Admin Verification
    // Never trust raw JWT role or permission claims without trusted database verification.
    if (!this.connection || (this.connection.readyState !== undefined && this.connection.readyState !== 1)) {
      throw new ForbiddenException('Security verification failed: Database unavailable');
    }

    const evalResult = await evaluateSuperAdminStatus(userId, this.connection);
    if (!evalResult.userExists) {
      if (evalResult.status === 'DATABASE_ERROR') {
        throw new ForbiddenException('Security verification failed: Database lookup error');
      }
      throw new UnauthorizedException('User account not found');
    }

    // Enforce Account Lifecycle Rules (Fail closed on inactive/blocked accounts)
    if (!evalResult.isActive) {
      if (evalResult.status === 'BLOCKED') {
        throw new ForbiddenException('تم حظر هذا الحساب من قبل إدارة المنصة');
      }
      if (evalResult.status === 'SUSPENDED') {
        throw new ForbiddenException('هذا الحساب معلق حالياً');
      }
      if (evalResult.status === 'DEACTIVATED') {
        throw new ForbiddenException('هذا الحساب معطل حالياً');
      }
      throw new ForbiddenException(`الحساب غير نشط (الحالة: ${evalResult.status})`);
    }

    // Anti-Spoofing: Overwrite untrusted JWT role with verified database role
    user.role = evalResult.role;
    const roleUpper = (user.role || '').toUpperCase().trim();
    const roleLower = (user.role || '').toLowerCase().trim();

    const isVerifiedSuperAdmin = evalResult.isSuperAdmin;

    // 2. Merchant Role Identification (Seller & Company Admin)
    const isSellerRole =
      roleUpper === 'SELLER' ||
      roleUpper === 'COMPANY_ADMIN' ||
      roleLower === 'seller' ||
      roleLower === 'company_admin' ||
      roleLower === RolesEnum.SELLER.toLowerCase() ||
      roleLower === RolesEnum.COMPANY_ADMIN.toLowerCase();

    if (isSellerRole) {
      if ((!user.sellingEntityId || !user.entityStatus) && userId && this.connection) {
        try {
          const sellingEntityModel = this.connection.models['SellingEntity'];
          if (sellingEntityModel) {
            const queryConditions: any[] = [];
            if (Types.ObjectId.isValid(userId)) {
              queryConditions.push({ primaryOwnerId: new Types.ObjectId(userId) });
            }
            if (user.sellingEntityId && Types.ObjectId.isValid(user.sellingEntityId)) {
              queryConditions.push({ _id: new Types.ObjectId(user.sellingEntityId) });
            }
            if (queryConditions.length > 0) {
              const entity = await sellingEntityModel.findOne({ $or: queryConditions }).lean();
              if (entity) {
                user.sellingEntityId = entity._id ? entity._id.toString() : user.sellingEntityId;
                user.entityStatus = entity.status || user.entityStatus;
              }
            }
          }
        } catch {
          // silently continue
        }
      }

      // CRITICAL SECURITY ENFORCEMENT: Enforce APPROVED Status for commercial operations
      const allowPending = this.reflector.getAllAndOverride<boolean>(
        ALLOW_PENDING_ENTITY_KEY,
        [context.getHandler(), context.getClass()],
      );

      const entityStatus = (user.entityStatus || '').toUpperCase().trim();
      if (
        !allowPending &&
        (entityStatus === 'PENDING_APPROVAL' ||
          entityStatus === 'SUSPENDED' ||
          entityStatus === 'REJECTED')
      ) {
        const hasRestrictedOperation = requiredPermissions.some((perm) => {
          const permStr = String(perm);
          return !PERMITTED_PRE_APPROVAL_PERMISSIONS.has(permStr);
        });

        if (hasRestrictedOperation) {
          if (entityStatus === 'SUSPENDED') {
            throw new ForbiddenException('حساب التاجر معلق من قبل إدارة المنصة');
          }
          if (entityStatus === 'REJECTED') {
            throw new ForbiddenException('تم رفض طلب تسجيل المتجر من قبل الإدارة');
          }
          throw new ForbiddenException('حساب التاجر قيد المراجعة والاعتماد من الإدارة');
        }
      }
    }

    // 3. Permission Resolution
    const defaultPerms = (getDefaultPermissionsForRole(user.role || RolesEnum.CUSTOMER) as string[]) || [];
    let tokenPerms = Array.isArray(user.permissions) ? user.permissions : [];

    if (isVerifiedSuperAdmin) {
      // Verified Super Admin is granted all canonical platform permissions
      tokenPerms = Array.from(
        new Set([...tokenPerms, ...evalResult.permissions, ...DEFAULT_SUPER_ADMIN_PERMISSIONS]),
      );
      user.permissions = tokenPerms;
    } else {
      // Anti-Spoofing: Strip platform.super_admin from unauthorized callers
      tokenPerms = tokenPerms.filter(
        (p: string) => p !== Permission.PLATFORM_SUPER_ADMIN && p !== 'platform.super_admin',
      );
      if (evalResult.permissions.length > 0) {
        tokenPerms = Array.from(new Set([...tokenPerms, ...evalResult.permissions]));
      }
      user.permissions = tokenPerms;
    }

    const userPermissions = new Set<string>([...tokenPerms, ...defaultPerms]);

    const hasAllPermissions = requiredPermissions.every((perm) => {
      const permStr = String(perm);
      if (userPermissions.has(permStr)) {
        return true;
      }
      // Check forward equivalence
      const equivs = CANONICAL_EQUIVALENCES[permStr];
      if (equivs && equivs.some((eq) => userPermissions.has(eq))) {
        return true;
      }
      // Check reverse equivalence
      for (const [canonical, aliases] of Object.entries(CANONICAL_EQUIVALENCES)) {
        if (aliases.includes(permStr) && userPermissions.has(canonical)) {
          return true;
        }
      }
      return false;
    });

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

export { PermissionsGuard as AuthorizationGuard, PermissionsGuard as ResourceScopeGuard };
