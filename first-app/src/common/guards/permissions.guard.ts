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
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionEnum } from '../enums/permissions.enum';
import { RolesEnum } from '../enums/roles';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly jwtService?: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<PermissionEnum[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

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

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const role = (user.role || '').toLowerCase();
    if (
      role === RolesEnum.SUPER_ADMIN.toLowerCase() ||
      role === 'admin' ||
      role === 'super_admin'
    ) {
      return true;
    }

    const userPermissions: string[] = Array.isArray(user.permissions)
      ? user.permissions
      : [];

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
