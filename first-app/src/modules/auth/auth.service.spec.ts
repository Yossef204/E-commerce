import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CACHE_SERVICE } from '../../shared/cache/interfaces/cache-service.interface';
import { MAILER_SERVICE } from '../../shared/mailer/interfaces/mailer.interface';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { RegisterSellerAuthDto } from './dto/register-seller-auth.dto';
import { UserRepo } from '../../models/user/user.repository';
import { CustomerRepo } from '../../models/customer/customer.repository';
import { SessionRepo } from '../../models/session/session.repository';
import { MailService } from '../../shared/mailer/mail.service';
import { PermissionRepo } from '../../models/permission/permission.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { User } from '../../models/user/user.schema';
import { SellingEntity } from '../../models/selling-entity/selling-entity.schema';
import { RolesEnum } from '../../common/enums/roles';
import { AccountStatusEnum } from '../../common/enums/account-status';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let customerRepo: any;
  let sessionRepo: any;
  let jwtService: any;
  let mailService: any;
  let configService: any;
  let permissionRepo: any;
  let sellingEntityRepo: any;
  let cacheManager: any;

  const mockUserId = new Types.ObjectId('650000000000000000000001');
  const mockSessionId = new Types.ObjectId('650000000000000000000002');
  const mockSellingEntityId = new Types.ObjectId('650000000000000000000003');

  const mockUser = {
    _id: mockUserId,
    email: 'test@example.com',
    password: 'hashed_password_123',
    userName: 'Test User',
    role: RolesEnum.SELLER,
    status: AccountStatusEnum.ACTIVE,
    isEmailVerified: true,
    sellingEntityId: mockSellingEntityId,
  };

  beforeEach(async () => {
    userRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ _id: mockUserId, ...data }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    customerRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...data }),
      ),
    };

    sessionRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ _id: mockSessionId, ...data }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock_jwt_token_sync'),
      signAsync: jest.fn().mockResolvedValue('mock_jwt_token_async'),
      verify: jest.fn().mockReturnValue({
        sub: mockUserId.toString(),
        id: mockUserId.toString(),
        tokenVersion: 1,
        tokenType: 'refresh',
        purpose: 'password_reset',
        email: 'user@example.com',
      }),
      verifyAsync: jest.fn().mockImplementation((token: string, opts?: any) => {
        return Promise.resolve(jwtService.verify(token, opts));
      }),
    };

    mailService = {
      send: jest.fn().mockResolvedValue(true),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET' || key === 'jwt.accessSecret')
          return 'test_jwt_secret_key';
        return null;
      }),
    };

    permissionRepo = {
      getOne: jest.fn().mockResolvedValue({
        userId: mockUserId.toString(),
        permissions: ['product.read', 'product.create', 'order.read'],
      }),
      upsertUserPermissions: jest.fn().mockResolvedValue(true),
    };

    sellingEntityRepo = {
      getOne: jest.fn().mockResolvedValue({
        _id: mockSellingEntityId,
        primaryOwnerId: mockUserId,
        status: 'APPROVED',
      }),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          _id: mockSellingEntityId,
          ...data,
        }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepo, useValue: userRepo },
        { provide: CustomerRepo, useValue: customerRepo },
        { provide: SessionRepo, useValue: sessionRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        { provide: MAILER_SERVICE, useValue: mailService },
        { provide: ConfigService, useValue: configService },
        { provide: PermissionRepo, useValue: permissionRepo },
        { provide: SellingEntityRepo, useValue: sellingEntityRepo },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: CACHE_SERVICE, useValue: cacheManager },
        { provide: getModelToken(User.name), useValue: {} },
        { provide: getModelToken(SellingEntity.name), useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user with role CUSTOMER without role in registerAuthDto', async () => {
      userRepo.getOne.mockResolvedValue(null);
      userRepo.create.mockImplementation((data: any) =>
        Promise.resolve({
          _id: mockUserId,
          ...data,
          toObject() {
            const { toObject, ...rest } = this;
            return rest;
          },
        }),
      );

      const dto: RegisterAuthDto = {
        userName: 'New Customer',
        email: 'customer@example.com',
        password: 'Password123!',
        phoneNumber: '+201012345678',
      };

      const result = await service.register(dto);

      expect(userRepo.getOne).toHaveBeenCalledWith({
        email: 'customer@example.com',
      });
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: 'New Customer',
          email: 'customer@example.com',
          phoneNumber: '+201012345678',
          role: RolesEnum.CUSTOMER,
        }),
      );
      expect(result.message).toContain('User registered successfully');
      expect(result.user).toBeDefined();
      expect(result.user.role).toBe(RolesEnum.CUSTOMER);
    });

    it('should throw ConflictException if email already in use', async () => {
      userRepo.getOne.mockResolvedValue(mockUser);

      const dto: RegisterAuthDto = {
        userName: 'New Customer',
        email: 'test@example.com',
        password: 'Password123!',
        phoneNumber: '+201012345678',
      };

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(userRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('registerSeller', () => {
    it('should register a new seller, link SellingEntity with PENDING_APPROVAL, and assign role', async () => {
      userRepo.getOne.mockResolvedValue(null);
      sellingEntityRepo.getOne.mockResolvedValue(null);
      sellingEntityRepo.create.mockImplementation((data: any) =>
        Promise.resolve({
          _id: mockSellingEntityId,
          ...data,
        }),
      );
      userRepo.create.mockImplementation((data: any) =>
        Promise.resolve({
          _id: mockUserId,
          ...data,
          toObject() {
            const { toObject, ...rest } = this;
            return rest;
          },
        }),
      );

      const dto: RegisterSellerAuthDto = {
        userName: 'New Seller',
        email: 'seller@example.com',
        password: 'Password123!',
        phoneNumber: '+201012345678',
        role: RolesEnum.SELLER,
        storeName: 'Unique Store Name',
        description: 'Tech store',
        taxOrCommercialNumber: '987-654',
      };

      const result = await service.registerSeller(dto);

      expect(userRepo.getOne).toHaveBeenCalledWith({
        email: 'seller@example.com',
      });
      expect(sellingEntityRepo.getOne).toHaveBeenCalled();
      expect(sellingEntityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          legalName: 'Unique Store Name',
          status: 'PENDING_APPROVAL',
        }),
      );
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: 'New Seller',
          email: 'seller@example.com',
          role: RolesEnum.SELLER,
          sellingEntityId: mockSellingEntityId,
        }),
      );
      expect(sellingEntityRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockSellingEntityId },
        { primaryOwnerId: expect.any(Types.ObjectId) },
      );
      expect(result.message).toContain('تم تسجيل المتجر بنجاح');
      expect(result.sellingEntity.status).toBe('PENDING_APPROVAL');
    });

    it('should throw ConflictException if store name is already in use', async () => {
      userRepo.getOne.mockResolvedValue(null);
      sellingEntityRepo.getOne.mockResolvedValue({
        _id: mockSellingEntityId,
        legalName: 'Unique Store Name',
      });

      const dto: RegisterSellerAuthDto = {
        userName: 'New Seller',
        email: 'seller@example.com',
        password: 'Password123!',
        phoneNumber: '+201012345678',
        role: RolesEnum.SELLER,
        storeName: 'Unique Store Name',
        taxOrCommercialNumber: '987-654',
      };

      await expect(service.registerSeller(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(sellingEntityRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user email does not exist', async () => {
      userRepo.getOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(userRepo.getOne).toHaveBeenCalledWith({
        email: 'nonexistent@example.com',
      });
    });

    it('should throw UnauthorizedException if password hash does not match', async () => {
      userRepo.getOne.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false as never));

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrong_password',
        mockUser.password,
      );
    });

    it('should successfully return tokens and user profile on valid credentials', async () => {
      userRepo.getOne.mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true as never));
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashed_refresh_token' as never));

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.accessToken).toBe('mock_jwt_token_async');
      expect(result.data.refreshToken).toBe('mock_jwt_token_async');
      expect(result.data.sessionId).toEqual(mockSessionId);
      expect(result.data.user.email).toBe(mockUser.email);
      expect(result.data.user.role).toBe(mockUser.role);
      expect(result.data.user.sellingEntityId).toBe(
        mockSellingEntityId.toString(),
      );
      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          refreshTokenHash: 'hashed_refresh_token',
          isRevoked: false,
        }),
      );
    });
  });

  describe('generateTokens & Fail-Open Redis Integration', () => {
    it('should retrieve tokenVersion from Redis when cache is responsive', async () => {
      cacheManager.get.mockResolvedValue('5');

      const result = await service.generateTokens(mockUser);

      expect(result.tokenVersion).toBe(5);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUserId.toString(),
          sub: mockUserId.toString(),
          tokenVersion: 5,
        }),
        expect.anything(),
      );
    });

    it('should fallback to default tokenVersion (1) safely when Redis times out or fails (Fail-Open test)', async () => {
      cacheManager.get.mockRejectedValue(new Error('Redis connection down'));

      const result = await service.generateTokens(mockUser);

      expect(result.tokenVersion).toBe(1);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUserId.toString(),
          sub: mockUserId.toString(),
          tokenVersion: 1,
        }),
        expect.anything(),
      );
    });

    it('should include user role, permissions count, and sellingEntityId in JWT payload', async () => {
      cacheManager.get.mockResolvedValue('2');
      const extraPayload = {
        sellingEntityId: mockSellingEntityId.toString(),
        entityStatus: 'APPROVED',
        permissions: ['product.read', 'product.create', 'order.read'],
      };

      const result = await service.generateTokens(mockUser, extraPayload);

      expect(result.tokenVersion).toBe(2);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUserId.toString(),
          sub: mockUserId.toString(),
          role: RolesEnum.SELLER,
          sellingEntityId: mockSellingEntityId.toString(),
          entityStatus: 'APPROVED',
          permissions: ['product.read', 'product.create', 'order.read'],
          tokenVersion: 2,
        }),
        expect.anything(),
      );
    });
  });

  describe('refreshToken (Session Rotation & Validation)', () => {
    it('should reject refresh if token version is mismatched (revoked session)', async () => {
      jwtService.verify.mockReturnValue({
        sub: mockUserId.toString(),
        id: mockUserId.toString(),
        tokenVersion: 1,
        tokenType: 'refresh',
      });

      userRepo.getOne.mockResolvedValue(mockUser);
      cacheManager.get.mockResolvedValue('3');

      await expect(
        service.refreshToken({
          refreshToken: 'valid_refresh_token_string',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should generate new token pair upon valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: mockUserId.toString(),
        id: mockUserId.toString(),
        tokenVersion: 1,
        tokenType: 'refresh',
      });

      userRepo.getOne.mockResolvedValue(mockUser);
      cacheManager.get.mockResolvedValue('1');

      const mockActiveSession = {
        _id: mockSessionId,
        userId: mockUserId,
        activeTokenHash: 'b4a8e6308cf26244',
        refreshTokenHash: 'hashed_valid_refresh_token',
        consumedTokenHashes: [],
        isRevoked: false,
        deviceInfo: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      };

      sessionRepo.getOne.mockImplementation((query: any) => {
        if (query.consumedTokenHashes) return Promise.resolve(null);
        return Promise.resolve(mockActiveSession);
      });
      sessionRepo.getAll.mockResolvedValue([mockActiveSession]);
      sessionRepo.updateOne.mockResolvedValue(mockActiveSession);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true as never));
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('new_hashed_refresh_token' as never));

      const result = await service.refreshToken({
        refreshToken: 'valid_refresh_token_string',
      });

      expect(result.accessToken).toBe('mock_jwt_token_async');
      expect(result.refreshToken).toBe('mock_jwt_token_async');

      expect(sessionRepo.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: mockSessionId, isRevoked: false }),
        expect.objectContaining({
          $set: expect.objectContaining({ activeTokenHash: expect.any(String) }),
          $push: expect.objectContaining({ consumedTokenHashes: expect.anything() }),
        }),
        expect.anything(),
      );
    });
  });

  describe('Password Reset Flow (DIP Cache & Mailer Integration)', () => {
    const testEmail = 'user@example.com';
    const testUser = {
      _id: mockUserId,
      email: testEmail,
      userName: 'Test User',
      password: 'oldHashedPassword',
    };

    describe('forgotPassword', () => {
      it('should save OTP with 600s TTL and dispatch email non-blockingly without hanging', async () => {
        userRepo.getOne.mockResolvedValue(testUser);
        cacheManager.set.mockResolvedValue(undefined);

        // Simulate slow/hanging mail dispatch
        let mailSent = false;
        mailService.send.mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              setTimeout(() => {
                mailSent = true;
                resolve();
              }, 100);
            }),
        );

        const startTime = Date.now();
        const response = await service.forgotPassword({ email: testEmail });
        const elapsedTime = Date.now() - startTime;

        // Sub-second response verification (fire-and-forget email)
        expect(elapsedTime).toBeLessThan(50);
        expect(response.success).toBe(true);
        expect(cacheManager.set).toHaveBeenCalledWith(
          `otp:reset-password:${testEmail}`,
          expect.stringMatching(/^[a-f0-9]{64}$/),
          600,
        );
      });

      it('should return identical success response and not throw if email does not exist (Enumeration Defense)', async () => {
        userRepo.getOne.mockResolvedValue(null);
        cacheManager.get.mockResolvedValue(null);
        jest.spyOn(bcrypt, 'hash').mockResolvedValue('dummy_hash' as never);

        const response = await service.forgotPassword({ email: 'nonexistent@example.com' });
        expect(response.success).toBe(true);
        expect(response.message).toBe('إذا كان البريد الإلكتروني مسجلاً، فقد تم إرسال رمز التحقق.');
      });

      it('should return immediate response even if mail delivery fails', async () => {
        userRepo.getOne.mockResolvedValue(testUser);
        cacheManager.set.mockResolvedValue(undefined);
        mailService.send.mockRejectedValue(new Error('SMTP unreachable'));

        const response = await service.forgotPassword({ email: testEmail });
        expect(response.success).toBe(true);
      });
    });

    describe('verifyResetOtp', () => {
      it('should successfully verify when OTP matches, purge cache, and issue signed resetToken', async () => {
        cacheManager.get.mockImplementation((key: string) => {
          if (key === `otp:reset-password:${testEmail}`) return Promise.resolve('123456');
          if (key === `otp:attempts:${testEmail}`) return Promise.resolve(0);
          return Promise.resolve(null);
        });
        cacheManager.del.mockResolvedValue(undefined);
        jwtService.signAsync.mockResolvedValue('crypto_signed_reset_token_jwt');

        const result = await service.verifyResetOtp({
          email: testEmail,
          otp: '123456',
        });

        expect(result.success).toBe(true);
        expect(result.data.resetToken).toBe('crypto_signed_reset_token_jwt');
        expect(cacheManager.del).toHaveBeenCalledWith(`otp:reset-password:${testEmail}`);
        expect(cacheManager.del).toHaveBeenCalledWith(`otp:attempts:${testEmail}`);
        expect(jwtService.signAsync).toHaveBeenCalledWith(
          expect.objectContaining({ email: testEmail, purpose: 'password_reset' }),
          expect.objectContaining({ expiresIn: '15m' }),
        );
      });

      it('should throw BadRequestException and increment attempts when OTP does not match or is missing', async () => {
        cacheManager.get.mockImplementation((key: string) => {
          if (key === `otp:reset-password:${testEmail}`) return Promise.resolve('999999');
          if (key === `otp:attempts:${testEmail}`) return Promise.resolve(1);
          return Promise.resolve(null);
        });
        cacheManager.set.mockResolvedValue(undefined);

        await expect(
          service.verifyResetOtp({
            email: testEmail,
            otp: '123456',
          }),
        ).rejects.toThrow('متبقي لديك 3 محاولات');

        expect(cacheManager.set).toHaveBeenCalledWith(`otp:attempts:${testEmail}`, 2, 600);
      });

      it('should throw BadRequestException and purge OTP when attempts reach 5', async () => {
        cacheManager.get.mockImplementation((key: string) => {
          if (key === `otp:reset-password:${testEmail}`) return Promise.resolve('999999');
          if (key === `otp:attempts:${testEmail}`) return Promise.resolve(4);
          return Promise.resolve(null);
        });
        cacheManager.del.mockResolvedValue(undefined);

        await expect(
          service.verifyResetOtp({
            email: testEmail,
            otp: 'wrong_otp',
          }),
        ).rejects.toThrow('تجاوزت الحد الأقصى للمحاولات');

        expect(cacheManager.del).toHaveBeenCalledWith(`otp:reset-password:${testEmail}`);
      });
    });

    describe('resetPassword', () => {
      beforeEach(() => {
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false as never));
      });

      it('should throw BadRequestException if newPassword matches current password', async () => {
        userRepo.getOne.mockResolvedValue(testUser);
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));

        await expect(
          service.resetPassword(testEmail, 'SamePassword123!'),
        ).rejects.toThrow('لا يمكن استخدام نفس كلمة المرور السابقة.');
      });

      it('should update password and globally revoke all sessions when called with (email, newPassword)', async () => {
        userRepo.getOne.mockResolvedValue(testUser);
        userRepo.updateOne.mockResolvedValue(testUser);
        sessionRepo.updateMany.mockResolvedValue({ modifiedCount: 3 });
        jest
          .spyOn(bcrypt, 'hash')
          .mockImplementation(() => Promise.resolve('new_hashed_password' as never));

        const result = await service.resetPassword(testEmail, 'NewPassword123!');

        expect(result.success).toBe(true);
        expect(userRepo.updateOne).toHaveBeenCalledWith(
          { _id: mockUserId },
          expect.objectContaining({
            password: 'new_hashed_password',
            $inc: { tokenVersion: 1 },
          }),
        );
        expect(sessionRepo.updateMany).toHaveBeenCalledWith(
          { userId: mockUserId, isRevoked: false },
          expect.objectContaining({
            $set: expect.objectContaining({
              isRevoked: true,
              revocationReason: 'PASSWORD_RESET_GLOBAL_REVOCATION',
            }),
          }),
        );
      });

      it('should verify resetToken, update password, and globally revoke all sessions when called with dto', async () => {
        jwtService.verifyAsync.mockResolvedValue({
          email: testEmail,
          purpose: 'password_reset',
        });
        userRepo.getOne.mockResolvedValue(testUser);
        userRepo.updateOne.mockResolvedValue(testUser);
        sessionRepo.updateMany.mockResolvedValue({ modifiedCount: 3 });
        jest
          .spyOn(bcrypt, 'hash')
          .mockImplementation(() => Promise.resolve('new_hashed_password' as never));

        const result = await service.resetPassword({
          resetToken: 'valid_crypto_reset_token',
          newPassword: 'NewPassword123!',
        });

        expect(result.success).toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith(
          'valid_crypto_reset_token',
          expect.any(Object),
        );
        expect(userRepo.updateOne).toHaveBeenCalledWith(
          { _id: mockUserId },
          expect.objectContaining({
            password: 'new_hashed_password',
            $inc: { tokenVersion: 1 },
          }),
        );
        expect(sessionRepo.updateMany).toHaveBeenCalledWith(
          { userId: mockUserId, isRevoked: false },
          expect.objectContaining({
            $set: expect.objectContaining({
              isRevoked: true,
              revocationReason: 'PASSWORD_RESET_GLOBAL_REVOCATION',
            }),
          }),
        );
      });

      it('should throw UnauthorizedException if resetToken is invalid or expired', async () => {
        jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

        await expect(
          service.resetPassword({
            resetToken: 'expired_or_invalid_token',
            newPassword: 'NewPassword123!',
          }),
        ).rejects.toThrow('رمز استعادة كلمة المرور غير صالح أو منتهي الصلاحية');
      });

      it('should throw UnauthorizedException if resetToken purpose is mismatched', async () => {
        jwtService.verifyAsync.mockResolvedValue({
          email: testEmail,
          purpose: 'access_token',
        });

        await expect(
          service.resetPassword({
            resetToken: 'mismatched_purpose_token',
            newPassword: 'NewPassword123!',
          }),
        ).rejects.toThrow('رمز استعادة كلمة المرور غير صالح أو الغرض غير متطابق');
      });
    });
  });
});
