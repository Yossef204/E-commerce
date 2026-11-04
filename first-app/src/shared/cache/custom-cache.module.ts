import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE } from './interfaces/cache-service.interface';
import { RedisCacheService } from './providers/redis-cache.service';

@Global()
@Module({
  providers: [
    RedisCacheService,
    {
      provide: CACHE_SERVICE,
      useClass: RedisCacheService,
    },
  ],
  exports: [CACHE_SERVICE, RedisCacheService],
})
export class CustomCacheModule {}

