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
import { Request } from 'express'; // 👈 استيراد نوع Request للـ TypeScript
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { IS_PUBLIC, isPublic } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimiterGuard } from '../../common/guards/rate-limiter.guard';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(RateLimiterGuard)
  @RateLimit({ limit: 5, ttlSeconds: 3600, keyPrefix: 'auth_register', trackBy: 'ip' })
  @Post('register')
  async register(@Body() registerAuthDto: RegisterAuthDto){ // 👈 حقن كائن الـ Request هنا) {
    const result = await this.authService.register(registerAuthDto);
    return {
      success: true,
      ...result,
    };
  }

  @UseGuards(RateLimiterGuard)
  @RateLimit({ limit: 5, ttlSeconds: 300, keyPrefix: 'auth_verify_otp', trackBy: 'ip_and_body' })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    return {
      success: true,
      ...result,
    };
  }

  @isPublic()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginAuthDto: LoginAuthDto, @Req() req: Request) {
    return this.authService.login(loginAuthDto, req);
  }
  @isPublic() // 👈 استخدام الـ Decorator لتحديد أن هذا المسار عام
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(refreshTokenDto);
    return {
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  @Post('logout/:sessionId')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Param('sessionId') sessionId: string,
    @Body('userId') userId: string,
  ) {
    return this.authService.logout(sessionId, userId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAllDevices(@Body('userId') userId: string) {
    return this.authService.logoutAllDevices(userId);
  }

  @isPublic()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @isPublic()
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  @isPublic()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
