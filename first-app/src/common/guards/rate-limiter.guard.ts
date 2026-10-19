import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RATE_LIMIT_METADATA_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private withTimeout<T>(promise: Promise<T>, ms = 500): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Cache/Redis Timeout')), ms),
      ),
    ]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Bypass rate limiting for login to prevent any hanging
    if (req.url && (req.url.includes('/auth/login') || req.path?.includes('/auth/login'))) {
      return true;
    }

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const rawIp =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const cleanIp = rawIp.replace(/^.*:/, ''); // clean ipv6 mapping if present

    let identifier = cleanIp;
    if (options.trackBy === 'ip_and_body') {
      const bodyIdentifier = (
        req.body?.email ||
        req.body?.userName ||
        req.body?.phoneNumber ||
        ''
      ).trim().toLowerCase();
      identifier = `${cleanIp}:${bodyIdentifier}`;
    } else if (options.trackBy === 'ip_and_user') {
      const userId = req.user?.id || req.user?.sub || req.user?._id || '';
      identifier = `${cleanIp}:${userId}`;
    } else if (options.trackBy === 'order_id') {
      const orderId = req.params?.id || req.body?.orderId || '';
      identifier = `${orderId || cleanIp}`;
    }

    const prefix = options.keyPrefix || 'rate_limit';
    const redisKey = `rl:${prefix}:${identifier}`;

    let count = 0;
    try {
      const rawVal: any = await this.withTimeout(this.cacheManager.get(redisKey), 500);
      count = typeof rawVal === 'number' ? rawVal : (rawVal ? parseInt(rawVal, 10) : 0);
    } catch {
      // Fail-open: if Redis or CacheManager has an issue or times out (>500ms), do not block the request
      return true;
    }

    if (count >= options.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'تم تجاوز الحد الأقصى للمحاولات المسموح بها (Too Many Requests)، يرجى المحاولة لاحقاً',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      await this.withTimeout(
        this.cacheManager.set(redisKey, count + 1, options.ttlSeconds * 1000),
        500,
      );
    } catch {
      // Fail-open: do not throw or alter status if setting count fails
    }

    return true;
  }
}
