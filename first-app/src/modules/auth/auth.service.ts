import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRepo } from '../../models/user/user.repository';
import { CustomerRepo } from '../../models/customer/customer.repository';
import { SessionRepo } from '../../models/session/session.repository';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../../shared/mailer/mail.service';
import { ConfigService } from '@nestjs/config';
import { RolesEnum } from '../../common/enums/roles';
import { AccountStatusEnum } from '../../common/enums/account-status';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly customerRepo: CustomerRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerAuthDto: RegisterAuthDto) {
    const { userName, email, password, phoneNumber } = registerAuthDto;

    const existingUser = await this.userRepo.getOne({
      email: email.toLowerCase(),
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, saltRounds);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    const createdUser = await this.customerRepo.create({
      userName,
      email: email.toLowerCase(),
      phoneNumber,
      password: hashedPassword,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: otpExpiresAt,
    });

    await this.mailService.send({
      to: email,
      subject: 'Welcome! Please confirm your email',
      html: `<p>Hello <strong>${userName}</strong>,</p><p>Your verification OTP is: <strong>${otp}</strong></p><p>This OTP will expire in 10 minutes.</p>`,
    });

    const rawUser = (createdUser as any).toObject
      ? (createdUser as any).toObject()
      : createdUser;

    const {
      password: _,
      emailVerificationOtpHash: __,
      emailVerificationOtpExpiresAt: ___,
      ...userResponse
    } = rawUser;

    return {
      message:
        'User registered successfully. Please verify your email using the OTP sent.',
      user: userResponse,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const user = await this.userRepo.getOne({ email: email.toLowerCase() });
    if (!user || !user._id) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      return { message: 'Email is already verified' };
    }

    if (
      !user.emailVerificationOtpExpiresAt ||
      new Date() > new Date(user.emailVerificationOtpExpiresAt)
    ) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one',
      );
    }

    if (!user.emailVerificationOtpHash) {
      throw new BadRequestException('No OTP found. Please request a new one');
    }

    const isOtpValid = await bcrypt.compare(otp, user.emailVerificationOtpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP code');
    }

    await this.userRepo.updateOne(
      { _id: user._id },
      {
        isEmailVerified: true,
        emailVerificationOtpHash: null,
        emailVerificationOtpExpiresAt: null,
      },
    );

    return {
      message: 'Email verified successfully. You can now login.',
    };
  }

  async login(loginDto: LoginAuthDto) {
    const { email, password, deviceInfo, ipAddress } = loginDto;

    const user = await this.userRepo.getOne({ email: email.toLowerCase() });
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const status = user.status ?? AccountStatusEnum.ACTIVE;
    if (status !== AccountStatusEnum.ACTIVE) {
      throw new ForbiddenException(
        `Account is ${status.toLowerCase()}. Access denied.`,
      );
    }

    if (user.role === RolesEnum.CUSTOMER && !user.isEmailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Please verify your email first.',
      );
    }

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: '7d',
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await this.sessionRepo.create({
      userId: user._id,
      refreshTokenHash,
      deviceInfo: deviceInfo || 'Unknown Device',
      ipAddress: ipAddress || 'Unknown IP',
      isRevoked: false,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session._id,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken, deviceInfo, ipAddress } = refreshTokenDto;

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepo.getOne({ _id: payload.sub });
    if (
      !user ||
      !user._id ||
      (user.status && user.status !== AccountStatusEnum.ACTIVE)
    ) {
      throw new ForbiddenException('User account is inactive or deleted');
    }

    const activeSessions = await this.sessionRepo.getAll({
      userId: user._id,
      isRevoked: false,
    });

    let matchedSession: any = null;
    for (const session of activeSessions) {
      const isMatch = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );
      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Session is invalid or has been revoked');
    }

    // Revoke old session (Token Rotation)
    await this.sessionRepo.updateOne(
      { _id: matchedSession._id },
      { isRevoked: true },
    );

    // Generate new Access and Refresh tokens
    const newPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: '15m',
    });

    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: '7d',
    });

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newSession = await this.sessionRepo.create({
      userId: user._id,
      refreshTokenHash: newRefreshTokenHash,
      deviceInfo: deviceInfo || matchedSession.deviceInfo,
      ipAddress: ipAddress || matchedSession.ipAddress,
      isRevoked: false,
      expiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: newSession._id,
    };
  }

  async logout(sessionId: string, userId: string) {
    const session = await this.sessionRepo.getOne({ _id: sessionId, userId });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepo.updateOne({ _id: sessionId }, { isRevoked: true });

    return {
      success: true,
      message: 'Logged out successfully from session',
    };
  }

  async logoutAllDevices(userId: string) {
    await this.sessionRepo.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    return {
      success: true,
      message: 'Logged out from all devices successfully',
    };
  }
}
