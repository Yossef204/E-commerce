import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  CACHE_SERVICE,
  ICacheService,
} from '../../../shared/cache/interfaces/cache-service.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ResetTokenGuard implements CanActivate {
  private static readonly processingJti = new Set<string>();

  public static clearProcessingJti(): void {
    ResetTokenGuard.processingJti.clear();
  }

  constructor(
    private readonly jwtService: JwtService,
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    @Inject(CACHE_SERVICE)
    private readonly cacheService?: ICacheService,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request?.headers?.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'يرجى تقديم رمز الاستعادة (Bearer Token)',
      );
    }

    const token = authorization.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException(
        'يرجى تقديم رمز الاستعادة (Bearer Token)',
      );
    }

    const resetSecret =
      this.configService?.get<string>('JWT_RESET_SECRET') ||
      process.env.JWT_RESET_SECRET ||
      this.configService?.get<string>('JWT_SECRET') ||
      this.configService?.get<any>('jwt')?.accessSecret ||
      process.env.ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      'default_jwt_secret_fallback';

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: resetSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'رمز استعادة كلمة المرور غير صالح أو منتهي الصلاحية',
      );
    }

    if (!payload || payload.purpose !== 'password_reset' || !payload.email) {
      throw new UnauthorizedException(
        'نوع الرمز غير صالح لإعادة تعيين كلمة المرور',
      );
    }

    if (!payload.jti) {
      throw new UnauthorizedException(
        'رمز استعادة كلمة المرور غير صالح أو مفقود المعرّف الفريد',
      );
    }

    // Concurrency / Race Condition Guard: ensure synchronous single-entry check for the jti
    if (ResetTokenGuard.processingJti.has(payload.jti)) {
      throw new UnauthorizedException(
        'تم استخدام رمز الاستعادة مسبقاً أو تم إبطاله',
      );
    }
    ResetTokenGuard.processingJti.add(payload.jti);

    // Compute jtiHash = SHA-256(payload.jti)
    const jtiHash = crypto
      .createHash('sha256')
      .update(payload.jti)
      .digest('hex');
    const validKey = `reset:valid:${jtiHash}`;

    // Atomic Single-Use Server Enforcement via Cache
    let isValid: any = null;
    if (this.cacheService) {
      isValid = await this.cacheService.get(validKey);
    } else if (this.cacheManager) {
      isValid = await this.cacheManager.get(validKey);
    } else {
      // Fallback only if no cache provider is available in context
      isValid = true;
    }

    if (!isValid) {
      throw new UnauthorizedException(
        'تم استخدام رمز الاستعادة مسبقاً أو تم إبطاله',
      );
    }

    // Immediately delete key from cache so it cannot be reused
    if (this.cacheService) {
      await this.cacheService.del(validKey);
    } else if (this.cacheManager) {
      await this.cacheManager.del(validKey);
    }

    // Attach decoded identity context onto request.user
    request.user = {
      email: payload.email.toLowerCase().trim(),
      purpose: payload.purpose,
      ...payload,
    };

    return true;
  }
}
