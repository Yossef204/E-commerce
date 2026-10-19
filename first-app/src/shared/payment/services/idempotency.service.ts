import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface IdempotencyRecord<T = any> {
  status: 'PENDING' | 'RESOLVED' | 'FAILED';
  response?: T;
  error?: string;
  createdAt: number;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly defaultTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private buildKey(key: string): string {
    return `idempotency:${key}`;
  }

  async get<T = any>(key: string): Promise<IdempotencyRecord<T> | null> {
    try {
      const data = await this.cacheManager.get<IdempotencyRecord<T>>(this.buildKey(key));
      return data || null;
    } catch (err: any) {
      this.logger.error(`Error reading idempotency key ${key}: ${err.message}`);
      return null;
    }
  }

  async lock(key: string, lockTtlMs = 60000): Promise<boolean> {
    const redisKey = this.buildKey(key);
    const existing = await this.cacheManager.get<IdempotencyRecord>(redisKey);
    if (existing) {
      return false;
    }
    const record: IdempotencyRecord = {
      status: 'PENDING',
      createdAt: Date.now(),
    };
    await this.cacheManager.set(redisKey, record, lockTtlMs);
    return true;
  }

  async saveResult<T = any>(key: string, response: T, ttlMs = this.defaultTtlMs): Promise<void> {
    const redisKey = this.buildKey(key);
    const record: IdempotencyRecord<T> = {
      status: 'RESOLVED',
      response,
      createdAt: Date.now(),
    };
    await this.cacheManager.set(redisKey, record, ttlMs);
  }

  async release(key: string): Promise<void> {
    const redisKey = this.buildKey(key);
    try {
      await this.cacheManager.del(redisKey);
    } catch (err: any) {
      this.logger.warn(`Failed to release idempotency key ${key}: ${err.message}`);
    }
  }

  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    ttlMs = this.defaultTtlMs,
  ): Promise<T> {
    if (!key) {
      return operation();
    }

    const cached = await this.get<T>(key);
    if (cached) {
      if (cached.status === 'PENDING') {
        throw new ConflictException('A request with this Idempotency-Key is currently in progress. Please retry shortly.');
      }
      if (cached.status === 'RESOLVED') {
        this.logger.log(`Idempotent hit for key: ${key}`);
        return cached.response as T;
      }
    }

    const locked = await this.lock(key);
    if (!locked) {
      throw new ConflictException('Concurrent request detected for this Idempotency-Key.');
    }

    try {
      const result = await operation();
      await this.saveResult(key, result, ttlMs);
      return result;
    } catch (error) {
      await this.release(key);
      throw error;
    }
  }
}

