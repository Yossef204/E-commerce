import { Injectable } from '@nestjs/common';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';

@Injectable()
export class CacheConfigService implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService) {}
  createCacheOptions(): CacheModuleOptions {
    return {
      ttl: 60 * 60 * 1000,
      stores: [new KeyvRedis(this.configService.get('cache').host as string)],
    };
  }
}
