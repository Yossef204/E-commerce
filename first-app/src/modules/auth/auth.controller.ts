import {
  Controller,
  Post,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  HttpCode,
  Req,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { RegisterSellerAuthDto } from './dto/register-seller-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { isPublic, Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimiterGuard } from '../../common/guards/rate-limiter.guard';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @isPublic()
  @Public()
  @UseGuards(RateLimiterGuard)
  @RateLimit({ limit: 5, ttlSeconds: 3600, keyPrefix: 'auth_register_seller', trackBy: 'ip' })
  @Post('register-seller')
  @ApiOperation({ summary: 'Register a new merchant (Seller / Company Admin)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Merchant registration initiated' })
  async registerSeller(@Body() registerSellerAuthDto: RegisterSellerAuthDto) {
    const result = await this.authService.registerSeller(registerSellerAuthDto);
    return {
      success: true,
      ...result,
    };
  }

  @isPublic()
  @Public()
  @UseGuards(RateLimiterGuard)
  @RateLimit({ limit: 5, ttlSeconds: 3600, keyPrefix: 'auth_register', trackBy: 'ip' })
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Customer registered successfully' })
  async register(@Body() registerAuthDto: RegisterAuthDto) {
    const result = await this.authService.register(registerAuthDto);
    return {
      success: true,
      ...result,
    };
  }

  @isPublic()
  @Public()
  @UseGuards(RateLimiterGuard)
  @RateLimit({ limit: 5, ttlSeconds: 300, keyPrefix: 'auth_verify_otp', trackBy: 'ip_and_body' })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email registration OTP' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email verified successfully' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    return {
      success: true,
      ...result,
    };
  }

  @isPublic()
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful' })
  async login(@Body() loginAuthDto: LoginAuthDto, @Req() req: Request) {
    return this.authService.login(loginAuthDto, req);
  }

  @isPublic()
  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT access token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Token refreshed' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(refreshTokenDto);
    return {
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @Post('logout/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout specific session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Logged out successfully' })
  async logout(
    @Param('sessionId') sessionId: string,
    @Body('userId') bodyUserId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub || bodyUserId;
    return this.authService.logout(sessionId, userId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Logged out from all devices' })
  async logoutAllDevices(
    @Body('userId') bodyUserId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub || bodyUserId;
    return this.authService.logoutAllDevices(userId);
  }

  @isPublic()
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reset OTP sent' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @isPublic()
  @Public()
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify reset password OTP' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reset OTP verified' })
  async verifyResetOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  @isPublic()
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with new hash' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
