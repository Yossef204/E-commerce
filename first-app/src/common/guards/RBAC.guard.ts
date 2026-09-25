import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionRepo } from '../../models/permission/permission.repository';
import { ExecutionContext } from '@nestjs/common/interfaces/features/execution-context.interface';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private readonly permissionRepo: PermissionRepo,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const permission = this.reflector.get('permission', context.getHandler());

    const userPermissions = await this.permissionRepo.getOne({
      userId: req.user.sub,
    });
    if (!userPermissions?.permissions.includes(permission)) {
      throw new ForbiddenException('unAuthorized ');
    }
    return true;
  }
}
