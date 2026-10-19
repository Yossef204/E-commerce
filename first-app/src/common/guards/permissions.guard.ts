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
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  PermissionEnum,
  getDefaultPermissionsForRole,
} from '../enums/permissions.enum';
import { RolesEnum } from '../enums/roles';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly jwtService?: JwtService,
    @Optional() @InjectConnection() private readonly connection?: Connection,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<PermissionEnum[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    const req = context.switchToHttp().getRequest();
    let user = req.user;

    if (!user && req.headers?.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        if (token && this.jwtService) {
          user = this.jwtService.verify(token);
          req.user = user;
        } else if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
            user = JSON.parse(payloadJson);
            req.user = user;
          }
        }
      } catch {
        throw new UnauthorizedException(
          'Invalid or expired authentication token',
        );
      }
    }

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const roleUpper = (user.role || '').toUpperCase();
    const roleLower = (user.role || '').toLowerCase();

    // Super Admin / Admin bypass
    if (
      roleUpper === 'SUPER_ADMIN' ||
      roleUpper === 'ADMIN' ||
      roleLower === 'admin' ||
      roleLower === 'super_admin' ||
      roleLower === RolesEnum.SUPER_ADMIN.toLowerCase()
    ) {
      return true;
    }

    const isSeller =
      roleUpper === 'SELLER' ||
      roleUpper === 'COMPANY_ADMIN' ||
      roleLower === 'seller' ||
      roleLower === 'company_admin' ||
      roleLower === RolesEnum.SELLER.toLowerCase() ||
      roleLower === RolesEnum.COMPANY_ADMIN.toLowerCase();

    if (isSeller) {
      const userId = user.id || user.sub || user._id;
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
    }

    // Merge token permissions with default permissions for the user's role
    const defaultPerms = (getDefaultPermissionsForRole(user.role || RolesEnum.CUSTOMER) as string[]) || [];
    const tokenPerms = Array.isArray(user.permissions) ? user.permissions : [];
    const userPermissions: string[] = Array.from(new Set([...tokenPerms, ...defaultPerms]));

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      if (
        isSeller &&
        (user.entityStatus === 'PENDING_APPROVAL' ||
          user.entityStatus === 'pending_approval')
      ) {
        throw new ForbiddenException(
          'حساب التاجر قيد المراجعة والاعتماد من الإدارة',
        );
      }
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

export { PermissionsGuard as AuthorizationGuard, PermissionsGuard as ResourceScopeGuard };
