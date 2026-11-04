import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/role.decorators';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { RolesEnum } from '../enums/roles';
import { evaluateSuperAdminStatus } from '../utils/super-admin.policy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<
      (RolesEnum | string)[]
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // If endpoint is marked public and requires no roles, pass immediately
    if (isPublic && (!requiredRoles || requiredRoles.length === 0)) {
      return true;
    }

    // If no specific roles are required, allow passage
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

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
      throw new UnauthorizedException('User not authenticated');
    }

    // 1. Super Admin bypass policy
    const evalResult = await evaluateSuperAdminStatus(user);
    if (
      evalResult.isSuperAdmin ||
      (user.role &&
        user.role.toString().toLowerCase() === RolesEnum.SUPER_ADMIN.toLowerCase())
    ) {
      return true;
    }

    // 2. Normalize user roles
    const userRoles: string[] = [];
    if (user.role) {
      userRoles.push(user.role.toString().toLowerCase().trim());
    }
    if (Array.isArray(user.roles)) {
      user.roles.forEach((r: any) => {
        if (r) userRoles.push(r.toString().toLowerCase().trim());
      });
    }

    // 3. Normalize required roles
    const normalizedRequiredRoles = requiredRoles.map((r) =>
      r.toString().toLowerCase().trim(),
    );

    const hasRequiredRole = normalizedRequiredRoles.some((requiredRole) =>
      userRoles.includes(requiredRole),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Insufficient role permissions. Required: [${normalizedRequiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
