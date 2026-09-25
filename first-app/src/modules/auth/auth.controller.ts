import {
  Controller,
  Post,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerAuthDto: RegisterAuthDto) {
    const result = await this.authService.register(registerAuthDto);
    return {
      success: true,
      ...result,
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    return {
      success: true,
      ...result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginAuthDto: LoginAuthDto) {
    const result = await this.authService.login(loginAuthDto);
    return {
      success: true,
      message: 'Login successful',
      data: result,
    };
  }

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
}
