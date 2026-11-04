import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CACHE_SERVICE } from '../../../shared/cache/interfaces/cache-service.interface';
import { MAILER_SERVICE } from '../../../shared/mailer/interfaces/mailer.interface';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../auth.service';
import { CryptoTokenUtil } from '../../../common/utils/crypto-token.util';
import { SessionRepo } from '../../../models/session/session.repository';
import { UserRepo } from '../../../models/user/user.repository';
import { CustomerRepo } from '../../../models/customer/customer.repository';
import { PermissionRepo } from '../../../models/permission/permission.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { MailService } from '../../../shared/mailer/mail.service';
import { RolesEnum } from '../../../common/enums/roles';
import { AccountStatusEnum } from '../../../common/enums/account-status';

describe('Refresh Token Rotation (RTR) & Reuse Prevention Integration Spec', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const JWT_SECRET = 'super_secret_test_key_for_rtr_rotation_spec_2026';
  const mockUserId = new Types.ObjectId('650000000000000000000099');

  const mockUser = {
    _id: mockUserId,
    email: 'test-rtr@example.com',
    userName: 'RTR User',
    password: 'hashed_password_123',
    role: RolesEnum.CUSTOMER,
    status: AccountStatusEnum.ACTIVE,
    tokenVersion: 1,
    sellingEntityId: null,
  };

  // In-Memory Session Storage simulating MongoDB Collection with atomic findOneAndUpdate
  const inMemorySessions = new Map<string, any>();

  const createSessionRepoMock = () => {
    return {
      create: jest.fn().mockImplementation((data: any) => {
        const id = data._id || new Types.ObjectId();
        const doc = {
          _id: id,
          consumedTokenHashes: [],
          isRevoked: false,
          revocationReason: null,
          createdAt: new Date(),
          ...data,
        };
        inMemorySessions.set(id.toString(), doc);
        return Promise.resolve({ ...doc });
      }),

      getOne: jest.fn().mockImplementation((filter: any) => {
        for (const session of inMemorySessions.values()) {
          let matches = true;

          if (filter._id && session._id.toString() !== filter._id.toString()) {
            matches = false;
          }
          if (filter.userId && session.userId.toString() !== filter.userId.toString()) {
            matches = false;
          }
          if (filter.isRevoked !== undefined && session.isRevoked !== filter.isRevoked) {
            matches = false;
          }
          if (filter.activeTokenHash && session.activeTokenHash !== filter.activeTokenHash) {
            matches = false;
          }
          if (filter.consumedTokenHashes) {
            const hasConsumed =
              Array.isArray(session.consumedTokenHashes) &&
              session.consumedTokenHashes.includes(filter.consumedTokenHashes);
            if (!hasConsumed) {
              matches = false;
            }
          }

          if (matches) {
            return Promise.resolve({ ...session });
          }
        }
        return Promise.resolve(null);
      }),

      getAll: jest.fn().mockImplementation((filter: any) => {
        const results = [];
        for (const session of inMemorySessions.values()) {
          let matches = true;
          if (filter.userId && session.userId.toString() !== filter.userId.toString()) {
            matches = false;
          }
          if (filter.isRevoked !== undefined && session.isRevoked !== filter.isRevoked) {
            matches = false;
          }
          if (matches) {
            results.push({ ...session });
          }
        }
        return Promise.resolve(results);
      }),

      updateOne: jest.fn().mockImplementation((filter: any, update: any, options?: any) => {
        return mockFindOneAndUpdate(filter, update, options);
      }),

      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        let count = 0;
        for (const session of inMemorySessions.values()) {
          let matches = true;
          if (filter.userId && session.userId.toString() !== filter.userId.toString()) {
            matches = false;
          }
          if (filter.isRevoked !== undefined && session.isRevoked !== filter.isRevoked) {
            matches = false;
          }
          if (matches) {
            if (update.$set) {
              Object.assign(session, update.$set);
            }
            count++;
          }
        }
        return Promise.resolve({ modifiedCount: count });
      }),

      model: {
        findOneAndUpdate: jest.fn().mockImplementation((filter: any, update: any, options?: any) => {
          return {
            exec: () => mockFindOneAndUpdate(filter, update, options),
          };
        }),
      },
    };
  };

  const mockFindOneAndUpdate = (filter: any, update: any, options?: any) => {
    let targetSession: any = null;
    for (const session of inMemorySessions.values()) {
      let matches = true;
      if (filter._id && session._id.toString() !== filter._id.toString()) {
        matches = false;
      }
      if (filter.isRevoked !== undefined && session.isRevoked !== filter.isRevoked) {
        matches = false;
      }
      if (filter.activeTokenHash && session.activeTokenHash !== filter.activeTokenHash) {
        matches = false;
      }
      if (matches) {
        targetSession = session;
        break;
      }
    }

    if (!targetSession) {
      return Promise.resolve(null);
    }

    if (update.$set) {
      Object.assign(targetSession, update.$set);
    }
    if (update.$push) {
      for (const [key, pushVal] of Object.entries(update.$push)) {
        if (!targetSession[key]) {
          targetSession[key] = [];
        }
        if (pushVal && typeof pushVal === 'object' && '$each' in pushVal) {
          targetSession[key].push(...(pushVal as any).$each);
          if ((pushVal as any).$slice && (pushVal as any).$slice < 0) {
            targetSession[key] = targetSession[key].slice((pushVal as any).$slice);
          }
        } else {
          targetSession[key].push(pushVal);
        }
      }
    }

    return Promise.resolve({ ...targetSession });
  };

  let sessionRepoMock: any;
  let cacheStore: Record<string, any>;

  beforeEach(async () => {
    inMemorySessions.clear();
    cacheStore = {};
    sessionRepoMock = createSessionRepoMock();

    const realJwt = new JwtService({
      secret: JWT_SECRET,
    });

    const userRepoMock = {
      getOne: jest.fn().mockImplementation((query: any) => {
        const qId = query._id?.toString();
        if (qId === mockUserId.toString() || query.email === mockUser.email) {
          return Promise.resolve({ ...mockUser });
        }
        return Promise.resolve(null);
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return JWT_SECRET;
        return null;
      }),
    };

    const cacheManagerMock = {
      get: jest.fn().mockImplementation((key: string) => Promise.resolve(cacheStore[key] || '1')),
      set: jest.fn().mockImplementation((key: string, val: any) => {
        cacheStore[key] = val;
        return Promise.resolve();
      }),
    };

    const permissionRepoMock = {
      getOne: jest.fn().mockResolvedValue({ permissions: [] }),
      upsertUserPermissions: jest.fn().mockResolvedValue(true),
    };

    const sellingEntityRepoMock = {
      getOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: realJwt },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
        { provide: CACHE_SERVICE, useValue: cacheManagerMock },
        { provide: SessionRepo, useValue: sessionRepoMock },
        { provide: UserRepo, useValue: userRepoMock },
        { provide: CustomerRepo, useValue: {} },
        { provide: PermissionRepo, useValue: permissionRepoMock },
        { provide: SellingEntityRepo, useValue: sellingEntityRepoMock },
        { provide: MailService, useValue: { send: jest.fn().mockResolvedValue(true) } },
        { provide: MAILER_SERVICE, useValue: { send: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = realJwt;
  });

  // =========================================================================
  // Test 1: Valid Rotation
  // =========================================================================
  it('1. Valid Rotation: Refresh Token A returns 200 and yields Tokens B (Access B + Refresh B)', async () => {
    // Generate initial Token A and Session
    const initialTokens = await authService.generateTokens(mockUser);
    const tokenA = initialTokens.refreshToken;
    const activeHashA = CryptoTokenUtil.hashToken(tokenA);

    const session = await sessionRepoMock.create({
      userId: mockUserId,
      activeTokenHash: activeHashA,
      refreshTokenHash: activeHashA,
      consumedTokenHashes: [],
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Execute refresh using Token A
    const rotationResult = await authService.refreshToken({
      refreshToken: tokenA,
      deviceInfo: 'Chrome on macOS',
      ipAddress: '192.168.1.10',
    });

    // Assertions
    expect(rotationResult).toBeDefined();
    expect(rotationResult.accessToken).toBeDefined();
    expect(rotationResult.refreshToken).toBeDefined();
    expect(rotationResult.refreshToken).not.toEqual(tokenA);

    // Verify Session State in DB
    const updatedSession = inMemorySessions.get(session._id.toString());
    expect(updatedSession.isRevoked).toBe(false);
    expect(updatedSession.activeTokenHash).toBe(
      CryptoTokenUtil.hashToken(rotationResult.refreshToken),
    );
    expect(updatedSession.consumedTokenHashes).toContain(activeHashA);
  });

  // =========================================================================
  // Test 2: Token Reuse Detection
  // =========================================================================
  it('2. Token Reuse Detection: Sending Token A a second time returns 401, revokes the session, and subsequent calls with Token B also return 401', async () => {
    // Step 1: Initial Session with Token A
    const initialTokens = await authService.generateTokens(mockUser);
    const tokenA = initialTokens.refreshToken;
    const activeHashA = CryptoTokenUtil.hashToken(tokenA);

    const session = await sessionRepoMock.create({
      userId: mockUserId,
      activeTokenHash: activeHashA,
      refreshTokenHash: activeHashA,
      consumedTokenHashes: [],
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Step 2: First rotation with Token A -> Yields Token B
    const rotation1 = await authService.refreshToken({
      refreshToken: tokenA,
    });
    const tokenB = rotation1.refreshToken;
    expect(tokenB).toBeDefined();

    // Step 3: Attacker replays consumed Token A
    await expect(
      authService.refreshToken({
        refreshToken: tokenA,
      }),
    ).rejects.toThrow(UnauthorizedException);

    // Verify Session Family was revoked immediately
    const sessionAfterAttack = inMemorySessions.get(session._id.toString());
    expect(sessionAfterAttack.isRevoked).toBe(true);
    expect(sessionAfterAttack.revocationReason).toBe(
      'SECURITY_ALERT: REFRESH_TOKEN_REUSE_DETECTED',
    );

    // Step 4: Legitimate user subsequently attempts to use Token B
    await expect(
      authService.refreshToken({
        refreshToken: tokenB,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // =========================================================================
  // Test 3: Sequential Rotation (A -> B -> C -> B again)
  // =========================================================================
  it('3. Sequential Rotation: A -> B (200), B -> C (200), B again -> 401 and session revoked', async () => {
    // Token A
    const initial = await authService.generateTokens(mockUser);
    const tokenA = initial.refreshToken;

    const session = await sessionRepoMock.create({
      userId: mockUserId,
      activeTokenHash: CryptoTokenUtil.hashToken(tokenA),
      refreshTokenHash: CryptoTokenUtil.hashToken(tokenA),
      consumedTokenHashes: [],
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // A -> B
    const step1 = await authService.refreshToken({ refreshToken: tokenA });
    const tokenB = step1.refreshToken;

    // B -> C
    const step2 = await authService.refreshToken({ refreshToken: tokenB });
    const tokenC = step2.refreshToken;

    expect(tokenC).not.toEqual(tokenB);
    expect(tokenB).not.toEqual(tokenA);

    // Verify consumed history
    const sessionState = inMemorySessions.get(session._id.toString());
    expect(sessionState.consumedTokenHashes).toEqual([
      CryptoTokenUtil.hashToken(tokenA),
      CryptoTokenUtil.hashToken(tokenB),
    ]);
    expect(sessionState.activeTokenHash).toBe(CryptoTokenUtil.hashToken(tokenC));

    // Replay Token B -> Must fail with 401 and revoke session
    await expect(
      authService.refreshToken({ refreshToken: tokenB }),
    ).rejects.toThrow(UnauthorizedException);

    expect(inMemorySessions.get(session._id.toString()).isRevoked).toBe(true);

    // Replay Token C after revocation -> Must fail with 401
    await expect(
      authService.refreshToken({ refreshToken: tokenC }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // =========================================================================
  // Test 4: Concurrency Test (Atomic Race Condition Guard)
  // =========================================================================
  it('4. Concurrency Test: Two simultaneous requests with Token A — exactly one succeeds with 200, the other fails with 401', async () => {
    const initial = await authService.generateTokens(mockUser);
    const tokenA = initial.refreshToken;

    await sessionRepoMock.create({
      userId: mockUserId,
      activeTokenHash: CryptoTokenUtil.hashToken(tokenA),
      refreshTokenHash: CryptoTokenUtil.hashToken(tokenA),
      consumedTokenHashes: [],
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Dispatch two simultaneous requests with identical token A
    const [res1, res2] = await Promise.allSettled([
      authService.refreshToken({ refreshToken: tokenA }),
      authService.refreshToken({ refreshToken: tokenA }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    // Exactly one succeeds and one fails
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const rejected = failures[0] as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(UnauthorizedException);
  });

  // =========================================================================
  // Test 5: Invalid Token Types
  // =========================================================================
  it('5. Invalid Token Types: Passing an access token to /auth/refresh-token fails with 401', async () => {
    const tokens = await authService.generateTokens(mockUser);
    const accessToken = tokens.accessToken;

    // Verify accessToken payload contains tokenType: 'access'
    const decoded: any = jwtService.decode(accessToken);
    expect(decoded.tokenType).toBe('access');

    // Attempt to use access token on refresh endpoint
    await expect(
      authService.refreshToken({
        refreshToken: accessToken,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // =========================================================================
  // Test 6: Revoked Session
  // =========================================================================
  it('6. Revoked Session: Attempting to refresh on an already revoked session fails with 401', async () => {
    const tokens = await authService.generateTokens(mockUser);
    const token = tokens.refreshToken;

    await sessionRepoMock.create({
      userId: mockUserId,
      activeTokenHash: CryptoTokenUtil.hashToken(token),
      refreshTokenHash: CryptoTokenUtil.hashToken(token),
      consumedTokenHashes: [],
      isRevoked: true, // Already revoked session
      revocationReason: 'PREVIOUS_SECURITY_REVOCATION',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await expect(
      authService.refreshToken({
        refreshToken: token,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

