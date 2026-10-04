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
import { PermissionRepo } from '../../models/permission/permission.repository';
import { getDefaultPermissionsForRole } from '../../common/enums/permissions.enum';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly customerRepo: CustomerRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly permissionRepo: PermissionRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
  ) {}

  async register(registerAuthDto: RegisterAuthDto ) {
    const { userName, email, password, phoneNumber, role } = registerAuthDto;

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

    let userRole: RolesEnum = RolesEnum.CUSTOMER; // Default role
    if(role){
      if (!Object.values(RolesEnum).includes(role)) {
        throw new BadRequestException('Invalid role specified');
      }
      userRole = role;
    }
    const createdUser = await this.userRepo.create({
      userName,
      email: email.toLowerCase(),
      phoneNumber,
      password: hashedPassword,
      role: userRole,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: otpExpiresAt,
    });

    const userId = createdUser._id
      ? createdUser._id.toString()
      : (createdUser as any).id;
    if (userId) {
      const defaultPerms = getDefaultPermissionsForRole(userRole);
      await this.permissionRepo.upsertUserPermissions(userId, defaultPerms);
    }

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
      const userIdStr = user._id.toString();
      return {
        message: 'Email is already verified',
        user: {
          id: userIdStr,
          email: user.email,
          userName: user.userName,
          role: user.role,
          sellingEntityId: user.sellingEntityId
            ? user.sellingEntityId.toString()
            : undefined,
        },
      };
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

    const userId = user._id.toString();
    const existingPerms = await this.permissionRepo.getOne({ userId });
    let userPermissions =
      existingPerms?.permissions && existingPerms.permissions.length > 0
        ? existingPerms.permissions
        : getDefaultPermissionsForRole(user.role || RolesEnum.CUSTOMER);

    if (
      !existingPerms ||
      !existingPerms.permissions ||
      existingPerms.permissions.length === 0
    ) {
      await this.permissionRepo.upsertUserPermissions(userId, userPermissions);
    }

    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
      sellingEntityId: user.sellingEntityId
        ? user.sellingEntityId.toString()
        : undefined,
      permissions: userPermissions,
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.sessionRepo.create({
      userId: user._id,
      refreshTokenHash,
      deviceInfo: 'Web Browser',
      ipAddress: '127.0.0.1',
      isRevoked: false,
      expiresAt,
    });

    return {
      message: 'Email verified successfully.',
      accessToken,
      refreshToken,
      sessionId: session._id,
      user: {
        id: userId,
        email: user.email,
        userName: user.userName,
        role: user.role,
        sellingEntityId: user.sellingEntityId
          ? user.sellingEntityId.toString()
          : undefined,
        permissions: userPermissions,
      },
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

    const userIdStr = user._id.toString();
    const userPermissionsDoc = await this.permissionRepo.getOne({
      userId: userIdStr,
    });
    const userPermissions: string[] =
      userPermissionsDoc?.permissions &&
      userPermissionsDoc.permissions.length > 0
        ? userPermissionsDoc.permissions
        : getDefaultPermissionsForRole(user.role);

    // Directly query selling entity for SELLER / COMPANY_ADMIN
    let sellingEntityId: string | null = null;
    let entityStatus: string | null = null;

    const userRoleLower = (user.role || '').toLowerCase();
    if (
      userRoleLower === RolesEnum.SELLER.toLowerCase() ||
      userRoleLower === RolesEnum.COMPANY_ADMIN.toLowerCase() ||
      userRoleLower === 'seller' ||
      userRoleLower === 'company_admin'
    ) {
      const sellingEntity = await this.sellingEntityRepo.getOne({
        primaryOwnerId: user._id,
      });

      if (sellingEntity) {
        sellingEntityId = sellingEntity._id ? sellingEntity._id.toString() : null;
        entityStatus = sellingEntity.status || null;

        if (!user.sellingEntityId && sellingEntity._id) {
          await this.userRepo.updateOne(
            { _id: user._id },
            { sellingEntityId: sellingEntity._id },
          );
        }
      } else if (user.sellingEntityId) {
        const entityById = await this.sellingEntityRepo.getOne({
          _id: user.sellingEntityId,
        });
        if (entityById) {
          sellingEntityId = entityById._id ? entityById._id.toString() : null;
          entityStatus = entityById.status || null;
        }
      }
    }

    const payload = {
      sub: userIdStr,
      email: user.email,
      role: user.role,
      sellingEntityId:
        sellingEntityId ||
        (user.sellingEntityId ? user.sellingEntityId.toString() : undefined),
      entityStatus: entityStatus || undefined,
      permissions: userPermissions,
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
      sellingEntityId,
      entityStatus,
      user: {
        id: userIdStr,
        email: user.email,
        userName: user.userName,
        role: user.role,
        sellingEntityId,
        entityStatus,
        permissions: userPermissions,
      },
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

    const userIdStr = user._id.toString();
    const userPermissionsDoc = await this.permissionRepo.getOne({
      userId: userIdStr,
    });
    const userPermissions: string[] =
      userPermissionsDoc?.permissions &&
      userPermissionsDoc.permissions.length > 0
        ? userPermissionsDoc.permissions
        : getDefaultPermissionsForRole(user.role);

    let sellingEntityId: string | null = null;
    let entityStatus: string | null = null;

    const userRoleLower = (user.role || '').toLowerCase();
    if (
      userRoleLower === RolesEnum.SELLER.toLowerCase() ||
      userRoleLower === RolesEnum.COMPANY_ADMIN.toLowerCase() ||
      userRoleLower === 'seller' ||
      userRoleLower === 'company_admin'
    ) {
      const sellingEntity = await this.sellingEntityRepo.getOne({
        primaryOwnerId: user._id,
      });

      if (sellingEntity) {
        sellingEntityId = sellingEntity._id ? sellingEntity._id.toString() : null;
        entityStatus = sellingEntity.status || null;

        if (!user.sellingEntityId && sellingEntity._id) {
          await this.userRepo.updateOne(
            { _id: user._id },
            { sellingEntityId: sellingEntity._id },
          );
        }
      } else if (user.sellingEntityId) {
        const entityById = await this.sellingEntityRepo.getOne({
          _id: user.sellingEntityId,
        });
        if (entityById) {
          sellingEntityId = entityById._id ? entityById._id.toString() : null;
          entityStatus = entityById.status || null;
        }
      }
    }

    // Generate new Access and Refresh tokens with updated permissions and claims
    const newPayload = {
      sub: userIdStr,
      email: user.email,
      role: user.role,
      sellingEntityId:
        sellingEntityId ||
        (user.sellingEntityId ? user.sellingEntityId.toString() : undefined),
      entityStatus: entityStatus || undefined,
      permissions: userPermissions,
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
      sellingEntityId,
      entityStatus,
      user: {
        id: userIdStr,
        email: user.email,
        userName: user.userName,
        role: user.role,
        sellingEntityId,
        entityStatus,
        permissions: userPermissions,
      },
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
