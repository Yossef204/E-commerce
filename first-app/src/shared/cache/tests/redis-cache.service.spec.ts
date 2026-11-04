import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisCacheService } from '../providers/redis-cache.service';
import { CACHE_SERVICE } from '../interfaces/cache-service.interface';

describe('RedisCacheService (DIP Unit Test)', () => {
  let cacheService: RedisCacheService;
  let mockCacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    reset: jest.Mock;
  };

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        {
          provide: CACHE_SERVICE,
          useClass: RedisCacheService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    cacheService = module.get<RedisCacheService>(RedisCacheService);
  });

  it('should be defined and implement ICacheService', () => {
    expect(cacheService).toBeDefined();
    expect(typeof cacheService.get).toBe('function');
    expect(typeof cacheService.set).toBe('function');
    expect(typeof cacheService.del).toBe('function');
  });

  describe('get', () => {
    it('should return value when key exists', async () => {
      mockCacheManager.get.mockResolvedValue('test_value');
      const val = await cacheService.get<string>('my-key');
      expect(val).toBe('test_value');
      expect(mockCacheManager.get).toHaveBeenCalledWith('my-key');
    });

    it('should return null when key does not exist or is undefined', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const val = await cacheService.get<string>('non-existent');
      expect(val).toBeNull();
    });

    it('should return null and not throw if underlying cache throws', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Connection failure'));
      const val = await cacheService.get<string>('failing-key');
      expect(val).toBeNull();
    });
  });

  describe('set', () => {
    it('should convert ttlSeconds to milliseconds transparently', async () => {
      await cacheService.set('key1', 'val1', 600); // 600 seconds
      expect(mockCacheManager.set).toHaveBeenCalledWith('key1', 'val1', 600000);
    });

    it('should handle undefined ttlSeconds', async () => {
      await cacheService.set('key2', 'val2');
      expect(mockCacheManager.set).toHaveBeenCalledWith('key2', 'val2', undefined);
    });

    it('should catch errors gracefully without throwing', async () => {
      mockCacheManager.set.mockRejectedValue(new Error('Cache full'));
      await expect(cacheService.set('key3', 'val3', 60)).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should call cacheManager.del', async () => {
      await cacheService.del('key-to-del');
      expect(mockCacheManager.del).toHaveBeenCalledWith('key-to-del');
    });

    it('should catch del errors gracefully', async () => {
      mockCacheManager.del.mockRejectedValue(new Error('Del error'));
      await expect(cacheService.del('key')).resolves.not.toThrow();
    });
  });

  describe('reset', () => {
    it('should call reset on cacheManager', async () => {
      await cacheService.reset();
      expect(mockCacheManager.reset).toHaveBeenCalled();
    });
  });
});

