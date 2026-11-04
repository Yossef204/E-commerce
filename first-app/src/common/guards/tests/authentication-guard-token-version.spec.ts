import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AuthenticationGuard } from '../authentication.guard';
import { IS_PUBLIC } from '../../decorators/public.decorator';

describe('AuthenticationGuard — Token Version & Cache Consistency Regression Suite', () => {
  let guard: AuthenticationGuard;
  let jwtService: JwtService;
  let reflector: Reflector;
  let configService: ConfigService;
  let mockConnection: any;
  let mockUserModel: any;
  let mockCacheManager: any;
  const inMemoryCache = new Map<string, any>();

  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    inMemoryCache.clear();
    reflector = new Reflector();
    jwtService = new JwtService({ secret: 'test_jwt_secret' });
    configService = new ConfigService({
      JWT_SECRET: 'test_jwt_secret',
    });

    mockUserModel = {
      findById: jest.fn(),
    };

    mockConnection = {
      models: {
        User: mockUserModel,
      },
    };

    mockCacheManager = {
      get: jest.fn().mockImplementation((k: string) => inMemoryCache.get(k) ?? null),
      set: jest.fn().mockImplementation((k: string, v: any) => {
        inMemoryCache.set(k, v);
        return Promise.resolve();
      }),
    };

    guard = new AuthenticationGuard(
      jwtService,
      reflector,
      configService,
      mockCacheManager,
      mockConnection,
    );

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC) return false;
      return undefined;
    });
  });

  function createMockContext(tokenVersion: any): ExecutionContext {
    const token = jwtService.sign(
      {
        id: userId,
        sub: userId,
        email: 'test@example.com',
        role: 'customer',
        tokenVersion,
      },
      { secret: 'test_jwt_secret' },
    );

    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      user: null,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  describe('Cache Consistency Table Matrix', () => {
    it('MongoDB: 3, Redis: Missing -> Uses MongoDB 3, populates cache, accepts tokenVersion 3', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 3,
          }),
        }),
      });

      const context = createMockContext(3);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // Verify cache was populated with canonical key only
      expect(inMemoryCache.get(`auth:token_version:${userId}`)).toBe(3);
      expect(inMemoryCache.get(`token_version:${userId}`)).toBeUndefined();
    });

    it('MongoDB: 3, Redis: 3 -> Accepts version 3', async () => {
      inMemoryCache.set(`auth:token_version:${userId}`, 3);
      inMemoryCache.set(`token_version:${userId}`, 3);

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 3,
          }),
        }),
      });

      const context = createMockContext(3);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('MongoDB: 3, Redis: 2 -> MongoDB wins; repairs cache to 3, accepts tokenVersion 3', async () => {
      inMemoryCache.set(`auth:token_version:${userId}`, 2);
      inMemoryCache.set(`token_version:${userId}`, 2);

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 3,
          }),
        }),
      });

      const context = createMockContext(3);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // Verify cache was repaired to 3
      expect(inMemoryCache.get(`auth:token_version:${userId}`)).toBe(3);
    });

    it('MongoDB: 3, Redis: 5 -> MongoDB wins; repairs cache to 3, accepts tokenVersion 3', async () => {
      inMemoryCache.set(`auth:token_version:${userId}`, 5);
      inMemoryCache.set(`token_version:${userId}`, 5);

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 3,
          }),
        }),
      });

      const context = createMockContext(3);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // Verify cache was repaired to authoritative MongoDB version 3
      expect(inMemoryCache.get(`auth:token_version:${userId}`)).toBe(3);
    });

    it('MongoDB: Unavailable, Redis: 3 -> Fails closed with 401', async () => {
      inMemoryCache.set(`auth:token_version:${userId}`, 3);

      // Simulate MongoDB lookup throwing database connection failure
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('MongoNetworkTimeoutException')),
        }),
      });

      const context = createMockContext(3);
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('MongoDB: 3, Redis: Unavailable -> Safe fallback accepts version 3', async () => {
      // Simulate Redis cache manager throwing or timing out
      mockCacheManager.get.mockRejectedValue(new Error('Redis connection refused'));

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 3,
          }),
        }),
      });

      const context = createMockContext(3);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('TokenVersion Boundary & Edge Case Handling', () => {
    it('Preserves tokenVersion: 0 in database and accepts matching tokenVersion: 0', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 0,
          }),
        }),
      });

      const context = createMockContext(0);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(inMemoryCache.get(`auth:token_version:${userId}`)).toBe(0);
    });

    it('Rejects token with tokenVersion: 0 when database has incremented to 1', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 1,
          }),
        }),
      });

      const context = createMockContext(0);
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('Rejects token with negative tokenVersion', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 1,
          }),
        }),
      });

      const context = createMockContext(-1);
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('Rejects token with malformed or NaN tokenVersion', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            status: 'ACTIVE',
            tokenVersion: 1,
          }),
        }),
      });

      const context = createMockContext('malformed_version');
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});

