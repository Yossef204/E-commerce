import {
  CanActivate,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces/features/execution-context.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  parseAndValidateTokenVersion,
  syncTokenVersionToCache,
  getCachedTokenVersion,
} from '../utils/token-version.util';
import { IS_PUBLIC } from '../decorators/public.decorator';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
    @Optional() @InjectConnection() private readonly connection?: Connection,
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
      'default_jwt_secret_fallback';

    try {
      const decoded: any = await this.jwtService.verifyAsync(token, {
        secret: accessSecret,
      });

      if (decoded) {
        if (!decoded.id && decoded.sub) decoded.id = decoded.sub;
        if (!decoded.sub && decoded.id) decoded.sub = decoded.id;
      }

      // Token Invalidation Check via Redis and Database authoritative source
      const userId = decoded?.sub || decoded?.id;
      if (userId) {
        try {
          // 1. Check Redis cache using canonical key first (with legacy fallback)
          let currentRedisVersion: number | null = null;
          if (this.cacheManager) {
            currentRedisVersion = await Promise.race([
              getCachedTokenVersion(this.cacheManager, userId),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 150)),
            ]);
          }

          let dbUser: any = null;
          let dbError = false;

          // 2. Authoritative Verification from MongoDB
          const isDbConnected = !this.connection || this.connection.readyState === undefined || this.connection.readyState === 1;
          if (this.connection && isDbConnected && Types.ObjectId.isValid(userId)) {
            try {
              const userModel = this.connection.models['User'];
              if (userModel) {
                dbUser = await userModel.findById(userId).select('tokenVersion status').lean();
              }
            } catch (dbErr: any) {
              if (dbErr instanceof UnauthorizedException) throw dbErr;
              dbError = true;
            }
          } else {
            dbError = true;
          }

          // Case: MongoDB Unavailable or Error -> Fail closed
          if (dbError) {
            throw new UnauthorizedException(
              'Security verification failed: unable to verify session revocation state',
            );
          }

          if (!dbUser) {
            throw new UnauthorizedException('User account not found');
          }

          // Parse authoritative version from MongoDB (validates >= 0 integer, rejects NaN/negative)
          const dbVersion = parseAndValidateTokenVersion(
            (dbUser as any).tokenVersion,
            'dbTokenVersion',
          );

          // Account status enforcement: Inactive/blocked accounts are forbidden (403)
          const status = ((dbUser as any).status || '').toString().toUpperCase().trim();
          if (status && status !== 'ACTIVE') {
            if (status === 'BLOCKED') {
              throw new ForbiddenException('تم حظر هذا الحساب من قبل إدارة المنصة');
            }
            if (status === 'SUSPENDED') {
              throw new ForbiddenException('هذا الحساب معلق حالياً');
            }
            if (status === 'DEACTIVATED') {
              throw new ForbiddenException('هذا الحساب معطل حالياً');
            }
            throw new ForbiddenException(`الحساب غير نشط (الحالة: ${status})`);
          }

          // MongoDB is ALWAYS the authoritative source of truth.
          const expectedVersion = dbVersion;

          // Repair or populate cache if Redis was missing or desynchronized
          if (currentRedisVersion !== dbVersion && this.cacheManager) {
            await syncTokenVersionToCache(this.cacheManager, userId, dbVersion);
          }

          // Parse and validate incoming tokenVersion from JWT claims
          const incomingTokenVersion = parseAndValidateTokenVersion(
            decoded.tokenVersion,
            'incomingTokenVersion',
          );

          if (incomingTokenVersion !== expectedVersion) {
            throw new UnauthorizedException('الجلسة ملغاة، يرجى تسجيل الدخول مجدداً');
          }
        } catch (cacheErr: any) {
          if (
            cacheErr instanceof UnauthorizedException ||
            cacheErr instanceof ForbiddenException
          ) {
            throw cacheErr;
          }
          throw new UnauthorizedException('Authentication verification failed');
        }
      }

      req.user = decoded;
      return true;
    } catch (error: any) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
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
