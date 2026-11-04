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

import { AuthService } from '../auth.service';
import { ResetTokenGuard } from '../guards/reset-token.guard';
import { SessionRepo } from '../../../models/session/session.repository';
import { UserRepo } from '../../../models/user/user.repository';
import { CustomerRepo } from '../../../models/customer/customer.repository';
import { PermissionRepo } from '../../../models/permission/permission.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { CACHE_SERVICE } from '../../../shared/cache/interfaces/cache-service.interface';
import { MAILER_SERVICE } from '../../../shared/mailer/interfaces/mailer.interface';

describe('Two-Step Password Reset Flow & Cryptographic Reset Token Spec', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockUserId = new Types.ObjectId('650000000000000000000101');
  const testEmail = 'alice@souqna.com';
  const testPassword = 'OldSecurePassword123!';
  const newPassword = 'NewUltraSecurePassword2026!';
  const JWT_RESET_SECRET = 'super_secret_test_key_for_reset_flow_2026';

  let mockUser: any;
  let inMemoryCache: Map<string, any>;
  let sessionStore: any[];

  let userRepoMock: any;
  let sessionRepoMock: any;
  let mailerServiceMock: any;
  let cacheServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    inMemoryCache = new Map<string, any>();
    sessionStore = [
      {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        activeTokenHash: 'hash_token_1',
        refreshTokenHash: 'hash_refresh_1',
        isRevoked: false,
        revocationReason: null,
      },
      {
        _id: new Types.ObjectId(),
        userId: mockUserId,
        activeTokenHash: 'hash_token_2',
        refreshTokenHash: 'hash_refresh_2',
        isRevoked: false,
        revocationReason: null,
      },
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(), // Other user's session
        activeTokenHash: 'hash_other_token',
        refreshTokenHash: 'hash_other_refresh',
        isRevoked: false,
        revocationReason: null,
      },
    ];

    mockUser = {
      _id: mockUserId,
      email: testEmail,
      userName: 'Alice Security',
      password: await bcrypt.hash(testPassword, 10),
      role: 'CUSTOMER',
      tokenVersion: 1,
    };

    userRepoMock = {
      getOne: jest.fn().mockImplementation((query: any) => {
        if (query.email === testEmail) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        if (filter._id?.toString() === mockUserId.toString()) {
          if (update.password) mockUser.password = update.password;
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
    };

    sessionRepoMock = {
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
      send: jest.fn().mockResolvedValue(undefined),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_RESET_SECRET' || key === 'JWT_SECRET') return JWT_RESET_SECRET;
        return null;
      }),
    };

    // Use a real NestJS JwtService for authentic cryptographic signing and verification
    const realJwt = new JwtService({ secret: JWT_RESET_SECRET });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: realJwt },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: CACHE_SERVICE, useValue: cacheServiceMock },
        { provide: MAILER_SERVICE, useValue: mailerServiceMock },
        { provide: SessionRepo, useValue: sessionRepoMock },
        { provide: UserRepo, useValue: userRepoMock },
        { provide: CustomerRepo, useValue: {} },
        { provide: PermissionRepo, useValue: { getOne: jest.fn(), upsertUserPermissions: jest.fn() } },
        { provide: SellingEntityRepo, useValue: { getOne: jest.fn() } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = realJwt;
  });

  // =========================================================================
  // Test 1: Full End-to-End Two-Step Flow
  // =========================================================================
  it('1. End-to-End Flow: forgotPassword -> verifyResetOtp (single-use) -> resetPassword with resetToken & global session revocation', async () => {
    // Step 1: Request OTP
    const forgotResult = await authService.forgotPassword({ email: testEmail });
    expect(forgotResult.success).toBe(true);

    const otpKey = `otp:reset-password:${testEmail}`;
    expect(inMemoryCache.has(otpKey)).toBe(true);
    const storedHash = inMemoryCache.get(otpKey);
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);

    const mailCall = mailerServiceMock.send.mock.calls[0][0];
    const generatedOtp = mailCall.html.match(/\b\d{6}\b/)[0];
    expect(generatedOtp).toMatch(/^\d{6}$/);

    // Step 2: Verify OTP and receive cryptographic resetToken
    const verifyResult = await authService.verifyResetOtp({
      email: testEmail,
      otp: generatedOtp,
    });
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data).toBeDefined();
    expect(verifyResult.data.resetToken).toBeDefined();

    const resetToken = verifyResult.data.resetToken;

    // Single-use check: OTP must be purged from cache immediately
    expect(inMemoryCache.has(otpKey)).toBe(false);

    // Trying to re-use the same OTP must fail with 400
    await expect(
      authService.verifyResetOtp({
        email: testEmail,
        otp: generatedOtp,
      }),
    ).rejects.toThrow(BadRequestException);

    // Step 3: Extract and verify resetToken via ResetTokenGuard from Authorization: Bearer header
    ResetTokenGuard.clearProcessingJti();
    const guard = new ResetTokenGuard(jwtService, configServiceMock, cacheServiceMock);
    const req: any = {
      headers: {
        authorization: `Bearer ${resetToken}`,
      },
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe(testEmail);
    expect(req.user.purpose).toBe('password_reset');

    // Step 4: Reset password with decoupled signature (email, newPassword)
    const resetResult = await authService.resetPassword(req.user.email, newPassword);
    expect(resetResult.success).toBe(true);

    // Verify user password hash was changed
    const isNewPasswordMatch = await bcrypt.compare(newPassword, mockUser.password);
    expect(isNewPasswordMatch).toBe(true);

    const isOldPasswordMatch = await bcrypt.compare(testPassword, mockUser.password);
    expect(isOldPasswordMatch).toBe(false);

    // Verify all Alice's sessions were globally revoked
    const aliceSessions = sessionStore.filter(
      (s) => s.userId.toString() === mockUserId.toString(),
    );
    expect(aliceSessions.length).toBe(2);
    for (const s of aliceSessions) {
      expect(s.isRevoked).toBe(true);
      expect(s.revocationReason).toBe('PASSWORD_RESET_GLOBAL_REVOCATION');
    }

    // Other user's sessions must remain unaffected
    const otherSessions = sessionStore.filter(
      (s) => s.userId.toString() !== mockUserId.toString(),
    );
    expect(otherSessions[0].isRevoked).toBe(false);

    // Verify token version was incremented in cache
    const tokenVersionKey = `auth:token_version:${mockUserId.toString()}`;
    expect(inMemoryCache.get(tokenVersionKey)).toBe(2);
  });

  // =========================================================================
  // Test 2: Rate-Limiting & Brute-Force Defense (Max 5 Attempts)
  // =========================================================================
  it('2. Rate-Limiting: Capping attempts at 5, tracking remaining, and purging OTP on 5th failure', async () => {
    // Generate OTP
    await authService.forgotPassword({ email: testEmail });
    const otpKey = `otp:reset-password:${testEmail}`;
    const attemptsKey = `otp:attempts:${testEmail}`;
    expect(inMemoryCache.has(otpKey)).toBe(true);

    // Attempts 1 to 4: Failures decrement remaining attempts
    for (let i = 1; i <= 4; i++) {
      await expect(
        authService.verifyResetOtp({
          email: testEmail,
          otp: '000000',
        }),
      ).rejects.toThrow(`متبقي لديك ${5 - i} محاولات`);
      expect(inMemoryCache.get(attemptsKey)).toBe(i);
      expect(inMemoryCache.has(otpKey)).toBe(true); // OTP still intact
    }

    // 5th Attempt: Threshold exceeded -> immediate OTP purge
    await expect(
      authService.verifyResetOtp({
        email: testEmail,
        otp: '000000',
      }),
    ).rejects.toThrow('تجاوزت الحد الأقصى للمحاولات');

    // OTP key must now be completely destroyed
    expect(inMemoryCache.has(otpKey)).toBe(false);

    // 6th Attempt: Still blocked
    await expect(
      authService.verifyResetOtp({
        email: testEmail,
        otp: '000000',
      }),
    ).rejects.toThrow('تجاوزت الحد الأقصى للمحاولات');
  });

  // =========================================================================
  // Test 3: Cryptographic Token Protection & Tamper Resistance
  // =========================================================================
  it('3. Security: Rejects forged, expired, or purpose-mismatched reset tokens with 401', async () => {
    // A. Forged Token (signed with rogue secret)
    const rogueJwt = new JwtService({ secret: 'rogue_attacker_secret_999' });
    const forgedToken = await rogueJwt.signAsync({
      email: testEmail,
      purpose: 'password_reset',
    });

    await expect(
      authService.resetPassword({
        resetToken: forgedToken,
        newPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);

    // B. Expired Token
    const expiredToken = await jwtService.signAsync(
      { email: testEmail, purpose: 'password_reset' },
      { expiresIn: '-1s' }, // Expired 1 second ago
    );

    await expect(
      authService.resetPassword({
        resetToken: expiredToken,
        newPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);

    // C. Purpose Mismatch (e.g. attempting to pass an access_token or refresh_token)
    const mismatchedPurposeToken = await jwtService.signAsync({
      email: testEmail,
      purpose: 'access_token',
    });

    await expect(
      authService.resetPassword({
        resetToken: mismatchedPurposeToken,
        newPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);

    // D. Missing purpose altogether
    const noPurposeToken = await jwtService.signAsync({
      email: testEmail,
    });

    await expect(
      authService.resetPassword({
        resetToken: noPurposeToken,
        newPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // =========================================================================
  // Test 4: ResetTokenGuard Header Extraction & Context Attachment
  // =========================================================================
  it('4. ResetTokenGuard: Enforces Authorization: Bearer <token>, validates purpose, and attaches req.user', async () => {
    ResetTokenGuard.clearProcessingJti();
    const guard = new ResetTokenGuard(jwtService, configServiceMock, cacheServiceMock);

    // A. Missing Authorization header
    const reqMissing: any = { headers: {} };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqMissing }) } as any),
    ).rejects.toThrow('يرجى تقديم رمز الاستعادة (Bearer Token)');

    // B. Authorization header without Bearer prefix
    const reqNoBearer: any = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqNoBearer }) } as any),
    ).rejects.toThrow('يرجى تقديم رمز الاستعادة (Bearer Token)');

    // C. Empty Bearer token
    const reqEmptyBearer: any = { headers: { authorization: 'Bearer   ' } };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqEmptyBearer }) } as any),
    ).rejects.toThrow('يرجى تقديم رمز الاستعادة (Bearer Token)');

    // D. Purpose mismatched token
    const wrongPurposeToken = await jwtService.signAsync({
      email: testEmail,
      jti: 'test-uuid-wrong',
      purpose: 'email_verification',
    });
    const reqWrongPurpose: any = { headers: { authorization: `Bearer ${wrongPurposeToken}` } };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqWrongPurpose }) } as any),
    ).rejects.toThrow('نوع الرمز غير صالح لإعادة تعيين كلمة المرور');

    // E. Valid Token attaches user context and deletes single-use key
    const testJti = 'valid-test-jti-uuid';
    const jtiHash = crypto.createHash('sha256').update(testJti).digest('hex');
    inMemoryCache.set(`reset:valid:${jtiHash}`, testEmail);

    const validResetToken = await jwtService.signAsync({
      email: testEmail,
      jti: testJti,
      purpose: 'password_reset',
    });
    const reqValid: any = { headers: { authorization: `Bearer ${validResetToken}` } };
    const result = await guard.canActivate({
      switchToHttp: () => ({ getRequest: () => reqValid }),
    } as any);

    expect(result).toBe(true);
    expect(reqValid.user).toBeDefined();
    expect(reqValid.user.email).toBe(testEmail);
    expect(reqValid.user.purpose).toBe('password_reset');
    expect(inMemoryCache.has(`reset:valid:${jtiHash}`)).toBe(false);

    // F. Replay: Re-using the same token fails with 401
    const reqReplay: any = { headers: { authorization: `Bearer ${validResetToken}` } };
    await expect(
      guard.canActivate({ switchToHttp: () => ({ getRequest: () => reqReplay }) } as any),
    ).rejects.toThrow('تم استخدام رمز الاستعادة مسبقاً أو تم إبطاله');
  });
});

