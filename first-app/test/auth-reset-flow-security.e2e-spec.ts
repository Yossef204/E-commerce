import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { ResetTokenGuard } from '../src/modules/auth/guards/reset-token.guard';
import { AuthenticationGuard } from '../src/common/guards/authentication.guard';
import { SessionRepo } from '../src/models/session/session.repository';
import { UserRepo } from '../src/models/user/user.repository';
import { CustomerRepo } from '../src/models/customer/customer.repository';
import { PermissionRepo } from '../src/models/permission/permission.repository';
import { SellingEntityRepo } from '../src/models/selling-entity/selling-entity.repository';
import { CACHE_SERVICE } from '../src/shared/cache/interfaces/cache-service.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MAILER_SERVICE } from '../src/shared/mailer/interfaces/mailer.interface';
import { Reflector } from '@nestjs/core';

describe('Enterprise Hardening of Authentication & Password Reset Flow (E2E Security Spec)', () => {
  let authService: AuthService;
  let authController: AuthController;
  let jwtService: JwtService;
  let authGuard: AuthenticationGuard;

  const mockUserId = new Types.ObjectId('650000000000000000000777');
  const existingEmail = 'victim@enterprise.com';
  const nonExistingEmail = 'ghost@enterprise.com';
  const currentPassword = 'CurrentPassword123!';
  const newPassword = 'BrandNewPassword2026!';
  const JWT_SECRET = 'enterprise_super_secret_jwt_key_2026';

  let inMemoryCache: Map<string, any>;
  let sessionStore: any[];
  let userStore: Map<string, any>;
  let mailerSentMessages: any[];

  let cacheServiceMock: any;
  let mailerServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    ResetTokenGuard.clearProcessingJti();
    inMemoryCache = new Map<string, any>();
    mailerSentMessages = [];
    userStore = new Map<string, any>();

    const hashedCurrentPassword = await bcrypt.hash(currentPassword, 10);
    const existingUser = {
      _id: mockUserId,
      email: existingEmail,
      userName: 'Victim User',
      password: hashedCurrentPassword,
      role: 'CUSTOMER',
      tokenVersion: 1,
    };
    userStore.set(existingEmail, existingUser);

    sessionStore = [
      {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        activeTokenHash: 'active_hash_alpha',
        refreshTokenHash: 'refresh_hash_alpha',
        isRevoked: false,
        revocationReason: null,
      },
      {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        activeTokenHash: 'active_hash_beta',
        refreshTokenHash: 'refresh_hash_beta',
        isRevoked: false,
        revocationReason: null,
      },
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        activeTokenHash: 'other_user_token',
        isRevoked: false,
      },
    ];

    cacheServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(inMemoryCache.has(key) ? inMemoryCache.get(key) : null);
      }),
      set: jest.fn().mockImplementation((key: string, value: any, ttl?: number) => {
        inMemoryCache.set(key, value);
        return Promise.resolve();
      }),
      del: jest.fn().mockImplementation((key: string) => {
        inMemoryCache.delete(key);
        return Promise.resolve();
      }),
    };

    mailerServiceMock = {
      send: jest.fn().mockImplementation((msg: any) => {
        mailerSentMessages.push(msg);
        return Promise.resolve();
      }),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_RESET_SECRET' || key === 'JWT_SECRET') {
          return JWT_SECRET;
        }
        if (key === 'jwt') {
          return { accessSecret: JWT_SECRET };
        }
        return null;
      }),
    };

    const userRepoMock = {
      getOne: jest.fn().mockImplementation((query: any) => {
        const u = userStore.get(query.email);
        return Promise.resolve(u ? { ...u } : null);
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        for (const [em, u] of userStore.entries()) {
          if (filter._id?.toString() === u._id?.toString()) {
            if (update.password) u.password = update.password;
            if (update.$inc?.tokenVersion) u.tokenVersion = (u.tokenVersion || 1) + update.$inc.tokenVersion;
            userStore.set(em, u);
            return Promise.resolve(u);
          }
        }
        return Promise.resolve(null);
      }),
    };

    const sessionRepoMock = {
      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        let modifiedCount = 0;
        for (const s of sessionStore) {
          if (
            filter.userId?.toString() === s.userId?.toString() &&
            (!filter.isRevoked || s.isRevoked === filter.isRevoked)
          ) {
            if (update.$set) {
              Object.assign(s, update.$set);
            }
            modifiedCount++;
          }
        }
        return Promise.resolve({ modifiedCount });
      }),
      getAll: jest.fn().mockImplementation((filter: any) => {
        return Promise.resolve(
          sessionStore.filter(
            (s) => s.userId?.toString() === filter.userId?.toString(),
          ),
        );
      }),
    };

    const realJwt = new JwtService({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        ResetTokenGuard,
        { provide: JwtService, useValue: realJwt },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: CACHE_SERVICE, useValue: cacheServiceMock },
        { provide: CACHE_MANAGER, useValue: cacheServiceMock },
        { provide: MAILER_SERVICE, useValue: mailerServiceMock },
        { provide: UserRepo, useValue: userRepoMock },
        { provide: SessionRepo, useValue: sessionRepoMock },
        { provide: CustomerRepo, useValue: { getOne: jest.fn() } },
        { provide: PermissionRepo, useValue: { getOne: jest.fn(), getAll: jest.fn() } },
        { provide: SellingEntityRepo, useValue: { getOne: jest.fn() } },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    authController = module.get<AuthController>(AuthController);
    jwtService = realJwt;
    const mockConnection: any = {
      readyState: 1,
      models: {
        User: {
          findById: jest.fn().mockImplementation((id: any) => ({
            select: jest.fn().mockImplementation(() => ({
              lean: jest.fn().mockImplementation(() => {
                for (const u of userStore.values()) {
                  if (u._id?.toString() === id?.toString()) return Promise.resolve(u);
                }
                return Promise.resolve(null);
              }),
            })),
          })),
        },
      },
    };

    authGuard = new AuthenticationGuard(
      realJwt,
      new Reflector(),
      configServiceMock,
      cacheServiceMock,
      mockConnection,
    );
  });

  // =========================================================================
  // 1. Enumeration Defense
  // =========================================================================
  it('1. Enumeration: Existing and non-existing emails yield identical 200 responses', async () => {
    const existingRes = await authService.forgotPassword({ email: existingEmail });
    expect(existingRes.success).toBe(true);
    expect(existingRes.message).toBe('إذا كان البريد الإلكتروني مسجلاً، فقد تم إرسال رمز التحقق.');

    const nonExistingRes = await authService.forgotPassword({ email: nonExistingEmail });
    expect(nonExistingRes.success).toBe(true);
    expect(nonExistingRes.message).toBe('إذا كان البريد الإلكتروني مسجلاً، فقد تم إرسال رمز التحقق.');

    expect(existingRes).toEqual(nonExistingRes);
  });

  // =========================================================================
  // 2. OTP TTL Verification
  // =========================================================================
  it('2. OTP TTL: Expired or missing OTP in cache is rejected with 400', async () => {
    await expect(
      authService.verifyResetOtp({
        email: existingEmail,
        otp: '123456',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // =========================================================================
  // 3. OTP Hash Verification
  // =========================================================================
  it('3. OTP Hash Verification: Confirm plaintext OTP is never saved in cache directly', async () => {
    await authService.forgotPassword({ email: existingEmail });

    const cacheKey = `otp:reset-password:${existingEmail}`;
    expect(inMemoryCache.has(cacheKey)).toBe(true);
    const cachedValue = inMemoryCache.get(cacheKey);

    expect(cachedValue).toMatch(/^[a-f0-9]{64}$/);

    expect(mailerSentMessages.length).toBe(1);
    const rawOtp = mailerSentMessages[0].html.match(/\b\d{6}\b/)[0];
    expect(rawOtp).toMatch(/^\d{6}$/);

    const expectedHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    expect(cachedValue).toBe(expectedHash);
    expect(cachedValue).not.toBe(rawOtp);
  });

  // =========================================================================
  // 4. Brute Force Protection (Max 5 Attempts)
  // =========================================================================
  it('4. Brute Force Protection: Exactly 5 failed attempts locks and deletes the OTP', async () => {
    await authService.forgotPassword({ email: existingEmail });
    const cacheKey = `otp:reset-password:${existingEmail}`;
    expect(inMemoryCache.has(cacheKey)).toBe(true);

    for (let i = 1; i <= 4; i++) {
      await expect(
        authService.verifyResetOtp({
          email: existingEmail,
          otp: '000000',
        }),
      ).rejects.toThrow(`متبقي لديك ${5 - i} محاولات`);
      expect(inMemoryCache.has(cacheKey)).toBe(true);
    }

    await expect(
      authService.verifyResetOtp({
        email: existingEmail,
        otp: '000000',
      }),
    ).rejects.toThrow('تجاوزت الحد الأقصى للمحاولات');

    expect(inMemoryCache.has(cacheKey)).toBe(false);
  });

  // =========================================================================
  // 5. Cross-Token Attacks
  // =========================================================================
  it('5. Cross-Token Attacks: Standard Access Token and Refresh Token are rejected with 401 when sent to /auth/reset-password', async () => {
    const guard = new ResetTokenGuard(jwtService, configServiceMock, cacheServiceMock);

    const accessToken = await jwtService.signAsync({
      sub: mockUserId.toString(),
      email: existingEmail,
      role: 'CUSTOMER',
      tokenType: 'access',
    });

    const reqAccess: any = { headers: { authorization: `Bearer ${accessToken}` } };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqAccess }) } as any),
    ).rejects.toThrow('نوع الرمز غير صالح لإعادة تعيين كلمة المرور');

    const refreshToken = await jwtService.signAsync({
      sub: mockUserId.toString(),
      tokenType: 'refresh',
      sessionId: new Types.ObjectId().toString(),
    });

    const reqRefresh: any = { headers: { authorization: `Bearer ${refreshToken}` } };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqRefresh }) } as any),
    ).rejects.toThrow('نوع الرمز غير صالح لإعادة تعيين كلمة المرور');
  });

  // =========================================================================
  // 6. Token Replay (Single-Use Token)
  // =========================================================================
  it('6. Token Replay: Using the same resetToken twice fails on the 2nd attempt with 401', async () => {
    await authService.forgotPassword({ email: existingEmail });
    const rawOtp = mailerSentMessages[0].html.match(/\b\d{6}\b/)[0];
    const verifyResult = await authService.verifyResetOtp({ email: existingEmail, otp: rawOtp });
    const resetToken = verifyResult.data.resetToken;

    const guard = new ResetTokenGuard(jwtService, configServiceMock, cacheServiceMock);

    const req1: any = { headers: { authorization: `Bearer ${resetToken}` } };
    const canActivate1 = await guard.canActivate({ switchToHttp: () => ({ getRequest: () => req1 }) } as any);
    expect(canActivate1).toBe(true);

    const req2: any = { headers: { authorization: `Bearer ${resetToken}` } };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => req2 }) } as any),
    ).rejects.toThrow('تم استخدام رمز الاستعادة مسبقاً أو تم إبطاله');
  });

  // =========================================================================
  // 7. Concurrency / Race Condition Safety
  // =========================================================================
  it('7. Concurrency / Race Condition: Sending two concurrent requests with the same resetToken results in exactly one success and one 401 Unauthorized', async () => {
    await authService.forgotPassword({ email: existingEmail });
    const rawOtp = mailerSentMessages[0].html.match(/\b\d{6}\b/)[0];
    const verifyResult = await authService.verifyResetOtp({ email: existingEmail, otp: rawOtp });
    const resetToken = verifyResult.data.resetToken;

    const guard = new ResetTokenGuard(jwtService, configServiceMock, cacheServiceMock);

    const reqA: any = { headers: { authorization: `Bearer ${resetToken}` } };
    const reqB: any = { headers: { authorization: `Bearer ${resetToken}` } };

    const taskA = guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqA }) } as any);
    const taskB = guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqB }) } as any);

    const results = await Promise.allSettled([taskA, taskB]);

    const successes = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<boolean>).value === true);
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect((failures[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);
    expect((failures[0] as PromiseRejectedResult).reason.message).toBe('تم استخدام رمز الاستعادة مسبقاً أو تم إبطاله');
  });

  // =========================================================================
  // 8. Old Password Rejection
  // =========================================================================
  it('8. Old Password Rejection: Attempting to reset with the current password returns 400 Bad Request', async () => {
    await expect(
      authService.resetPassword(existingEmail, currentPassword),
    ).rejects.toThrow('لا يمكن استخدام نفس كلمة المرور السابقة.');
  });

  // =========================================================================
  // 9. Global Session Revocation
  // =========================================================================
  it('9. Global Session Revocation: Active sessions and previous refresh tokens are marked revoked in DB', async () => {
    const result = await authService.resetPassword(existingEmail, newPassword);
    expect(result.success).toBe(true);

    const victimSessions = sessionStore.filter((s) => s.userId.toString() === mockUserId.toString());
    expect(victimSessions.length).toBe(2);
    for (const session of victimSessions) {
      expect(session.isRevoked).toBe(true);
      expect(session.activeTokenHash).toBe('');
      expect(session.revocationReason).toBe('PASSWORD_RESET_GLOBAL_REVOCATION');
    }

    const otherSessions = sessionStore.filter((s) => s.userId.toString() !== mockUserId.toString());
    expect(otherSessions[0].isRevoked).toBe(false);
  });

  // =========================================================================
  // 10. Access Token Invalidation
  // =========================================================================
  it('10. Access Token Invalidation: Old access tokens issued prior to password reset fail authentication immediately due to tokenVersion mismatch', async () => {
    const oldAccessToken = await jwtService.signAsync({
      sub: mockUserId.toString(),
      email: existingEmail,
      role: 'CUSTOMER',
      tokenVersion: 1,
    });

    inMemoryCache.set(`auth:token_version:${mockUserId.toString()}`, 1);
    const reqBefore: any = { headers: { authorization: `Bearer ${oldAccessToken}` } };
    const canActivateBefore = await authGuard.canActivate({
      switchToHttp: () => ({ getRequest: () => reqBefore }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any);
    expect(canActivateBefore).toBe(true);

    await authService.resetPassword(existingEmail, newPassword);
    expect(inMemoryCache.get(`auth:token_version:${mockUserId.toString()}`)).toBe(2);

    const reqAfter: any = { headers: { authorization: `Bearer ${oldAccessToken}` } };
    await expect(
      authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => reqAfter }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any),
    ).rejects.toThrow('الجلسة ملغاة، يرجى تسجيل الدخول مجدداً');
  });
});

