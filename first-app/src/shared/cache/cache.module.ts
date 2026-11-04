import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE } from './interfaces/cache-service.interface';
import { RedisCacheService } from './providers/redis-cache.service';
import { CustomCacheModule } from './custom-cache.module';

export { CustomCacheModule };

@Global()
@Module({
  imports: [CustomCacheModule],
  exports: [CustomCacheModule, CACHE_SERVICE],
})
export class SharedCacheModule {}

