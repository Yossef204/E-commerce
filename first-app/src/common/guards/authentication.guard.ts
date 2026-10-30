import {
  CanActivate,
  Injectable,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces/features/execution-context.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IS_PUBLIC } from '../decorators/public.decorator';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
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

    if (req?.user && (req.user.id || req.user.sub)) {
      return true;
    }

    const authorization = req?.headers?.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    const token = authorization.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Authentication token is malformed');
    }

    const jwtConfig = this.configService.get<any>('jwt');
    const accessSecret =
      this.configService.get<string>('JWT_SECRET') ||
      jwtConfig?.accessSecret ||
      this.configService.get<string>('jwt.accessSecret') ||
      process.env.ACCESS_TOKEN_SECRET ||
      'fallback_super_secret_key_123';

    try {
      const decoded: any = await this.jwtService.verifyAsync(token, {
        secret: accessSecret,
      });

      if (decoded) {
        if (!decoded.id && decoded.sub) decoded.id = decoded.sub;
        if (!decoded.sub && decoded.id) decoded.sub = decoded.id;
      }

      // Token Invalidation Check via Redis (auth:token_version:${userId})
      if (this.cacheManager && decoded?.id) {
        try {
          const redisKey = `auth:token_version:${decoded.id}`;
          const currentRedisVersion = await Promise.race([
            this.cacheManager.get<number | string>(redisKey),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 20)),
          ]);

          if (currentRedisVersion !== null && currentRedisVersion !== undefined) {
            const tokenVersion = Number(decoded.tokenVersion ?? 1);
            const expectedVersion = Number(currentRedisVersion);
            if (tokenVersion < expectedVersion) {
              throw new UnauthorizedException('SESSION_EXPIRED');
            }
          }
        } catch (cacheErr: any) {
          if (cacheErr instanceof UnauthorizedException) {
            throw cacheErr;
          }
          // Non-blocking on Redis error or timeout - proceed safely
        }
      }

      req.user = decoded;
      return true;
    } catch (error: any) {
      if (
        error?.name === 'TokenExpiredError' ||
        error?.message === 'SESSION_EXPIRED'
      ) {
        throw new UnauthorizedException('SESSION_EXPIRED');
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
