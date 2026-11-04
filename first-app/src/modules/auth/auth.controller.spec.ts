import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { RegisterSellerAuthDto } from './dto/register-seller-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RolesEnum } from '../../common/enums/roles';
import { RateLimiterGuard } from '../../common/guards/rate-limiter.guard';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { ResetTokenGuard } from './guards/reset-token.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    registerSeller: jest.Mock;
    verifyOtp: jest.Mock;
    login: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
    logoutAllDevices: jest.Mock;
    forgotPassword: jest.Mock;
    verifyResetOtp: jest.Mock;
    resetPassword: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      registerSeller: jest.fn(),
      verifyOtp: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      logoutAllDevices: jest.fn(),
      forgotPassword: jest.fn(),
      verifyResetOtp: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: JwtService, useValue: { verifyAsync: jest.fn(), verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
      ],
    })
      .overrideGuard(RateLimiterGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResetTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerSeller', () => {
    it('should register a seller and return success response', async () => {
      const dto: RegisterSellerAuthDto = {
        userName: 'Store Owner',
        email: 'owner@example.com',
        password: 'Password123!',
        phoneNumber: '+201012345678',
        role: RolesEnum.SELLER,
        storeName: 'My Awesome Store',
        description: 'Tech store',
        taxOrCommercialNumber: '123-456',
      };
      const serviceResult = {
        message: 'Seller registered successfully',
        userId: 'seller_123',
        sellingEntity: { id: 'ent_123', storeName: 'My Awesome Store' },
      };
      authService.registerSeller.mockResolvedValue(serviceResult);

      const result = await controller.registerSeller(dto);

      expect(authService.registerSeller).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        ...serviceResult,
      });
    });
  });

  describe('register', () => {
    it('should register a user and return success response', async () => {
      const dto: RegisterAuthDto = {
        userName: 'New User',
        email: 'user@example.com',
        password: 'Password123!',
        phoneNumber: '+201012345678',
      };
      const serviceResult = { message: 'OTP sent to email', userId: 'user_123' };
      authService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        ...serviceResult,
      });
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and return success response', async () => {
      const dto: VerifyOtpDto = {
        email: 'user@example.com',
        otp: '123456',
      };
      const serviceResult = { message: 'Email verified successfully' };
      authService.verifyOtp.mockResolvedValue(serviceResult);

      const result = await controller.verifyOtp(dto);

      expect(authService.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        ...serviceResult,
      });
    });
  });

  describe('login', () => {
    it('should call authService.login with credentials and request', async () => {
      const dto: LoginAuthDto = {
        email: 'user@example.com',
        password: 'Password123!',
      };
      const req = { ip: '127.0.0.1' } as any;
      const loginResponse = { success: true, accessToken: 'jwt_token' };
      authService.login.mockResolvedValue(loginResponse);

      const result = await controller.login(dto, req);

      expect(authService.login).toHaveBeenCalledWith(dto, req);
      expect(result).toEqual(loginResponse);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token and wrap result', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'valid_refresh_token' };
      const tokens = { accessToken: 'new_acc_tok', refreshToken: 'new_ref_tok' };
      authService.refreshToken.mockResolvedValue(tokens);

      const result = await controller.refreshToken(dto);

      expect(authService.refreshToken).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens,
      });
    });
  });

  describe('logout', () => {
    it('should call authService.logout with sessionId and userId', async () => {
      const logoutResult = { success: true, message: 'Logged out successfully' };
      authService.logout.mockResolvedValue(logoutResult);

      const result = await controller.logout('sess_1', 'user_1');

      expect(authService.logout).toHaveBeenCalledWith('sess_1', 'user_1');
      expect(result).toEqual(logoutResult);
    });
  });

  describe('logoutAllDevices', () => {
    it('should call authService.logoutAllDevices with userId', async () => {
      const resultData = { success: true, message: 'Logged out from all devices' };
      authService.logoutAllDevices.mockResolvedValue(resultData);

      const result = await controller.logoutAllDevices('user_1');

      expect(authService.logoutAllDevices).toHaveBeenCalledWith('user_1');
      expect(result).toEqual(resultData);
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      const dto: ForgotPasswordDto = { email: 'user@example.com' };
      const response = { success: true, message: 'Reset OTP sent' };
      authService.forgotPassword.mockResolvedValue(response);

      const result = await controller.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('verifyResetOtp', () => {
    it('should call authService.verifyResetOtp', async () => {
      const dto: VerifyOtpDto = { email: 'user@example.com', otp: '123456' };
      const response = { success: true, resetToken: 'reset_token' };
      authService.verifyResetOtp.mockResolvedValue(response);

      const result = await controller.verifyResetOtp(dto);

      expect(authService.verifyResetOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword with email from req.user and newPassword', async () => {
      const req = { user: { email: 'user@example.com', purpose: 'password_reset' } };
      const dto: ResetPasswordDto = {
        newPassword: 'NewPassword123!',
      };
      const response = { success: true, message: 'Password reset successfully' };
      authService.resetPassword.mockResolvedValue(response);

      const result = await controller.resetPassword(req, dto);

      expect(authService.resetPassword).toHaveBeenCalledWith('user@example.com', 'NewPassword123!');
      expect(result).toEqual(response);
    });
  });
});
