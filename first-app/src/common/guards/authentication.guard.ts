import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces/features/execution-context.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/public.decorator';
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflactor: Reflector,
    private readonly configService: ConfigService,
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
    let jwtConfig = this.configService.get<any>('jwt');
    const accessSecret =
      jwtConfig?.accessSecret ||
      this.configService.get<string>('jwt.accessSecret') ||
      process.env.ACCESS_TOKEN_SECRET||
      'fallback_super_secret_key_123';
    req.user = this.jwtService.verify(token, { secret: accessSecret });
    return true;
  }
}
