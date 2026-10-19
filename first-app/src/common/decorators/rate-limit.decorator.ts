import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  ttlSeconds: number;
  keyPrefix?: string;
  trackBy?: 'ip' | 'ip_and_user' | 'ip_and_body' | 'order_id';
}

export const RATE_LIMIT_METADATA_KEY = 'RATE_LIMIT_METADATA_KEY';
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);
