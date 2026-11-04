import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ICacheService } from '../interfaces/cache-service.interface';

@Injectable()
export class RedisCacheService implements ICacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly TIMEOUT_MS = 1500; // مهلة أقصاها ثانية ونصف لأي عملية كاش

  constructor(
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
  ) {}

  /**
   * تغليف أي Promise بمهلة زمنية صارمة تمنع التعليق
   */
  private withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Cache ${operation} timed out after ${this.TIMEOUT_MS}ms`)), this.TIMEOUT_MS),
      ),
    ]);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.cacheManager) return null;
    try {
      const val = await this.withTimeout(this.cacheManager.get<T>(key), `get(${key})`);
      return val !== undefined && val !== null ? val : null;
    } catch (err: any) {
      this.logger.warn(`Cache get failed/timed out for "${key}": ${err?.message || err}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.cacheManager) return;
    try {
      const ttlMs = ttlSeconds !== undefined && ttlSeconds !== null ? ttlSeconds * 1000 : undefined;
      await this.withTimeout(this.cacheManager.set(key, value, ttlMs), `set(${key})`);
    } catch (err: any) {
      this.logger.warn(`Cache set failed/timed out for "${key}": ${err?.message || err}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.cacheManager) return;
    try {
      await this.withTimeout(this.cacheManager.del(key), `del(${key})`);
    } catch (err: any) {
      this.logger.warn(`Cache del failed/timed out for "${key}": ${err?.message || err}`);
    }
  }

  async reset(): Promise<void> {
    if (!this.cacheManager) return;
    try {
      const resetFn =
        (this.cacheManager as any).reset ||
        (this.cacheManager as any).clear ||
        (this.cacheManager as any)?.store?.reset;

      if (typeof resetFn === 'function') {
        await this.withTimeout(resetFn.call(this.cacheManager), 'reset');
      }
    } catch (err: any) {
      this.logger.warn(`Cache reset failed/timed out: ${err?.message || err}`);
    }
  }

  get store(): any {
    return (this.cacheManager as any)?.store;
  }
}