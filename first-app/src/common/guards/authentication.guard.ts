import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces/features/execution-context.interface';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/public.decorator';
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflactor: Reflector,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflactor.getAllAndOverride(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const req = context.switchToHttp().getRequest();
    const authorization = req.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('token is missing !!');
    }
    const token = authorization.split(' ')[1];
    req.user = this.jwtService.verify(token);
    return true;
  }
}
