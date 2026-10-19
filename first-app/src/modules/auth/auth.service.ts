import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepo: UserRepo,
    private readonly customerRepo: CustomerRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly permissionRepo: PermissionRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
    const existingPermsDoc = await this.permissionRepo.getOne({ userId });
    const defaultPerms = (getDefaultPermissionsForRole(user.role || RolesEnum.CUSTOMER) as string[]) || [];
    const existingPerms =
      existingPermsDoc?.permissions &&
      Array.isArray(existingPermsDoc.permissions)
        ? existingPermsDoc.permissions
        : [];
    const userPermissions: string[] = Array.from(
      new Set([...existingPerms, ...defaultPerms]),
    );

    if (
      !existingPermsDoc ||
      defaultPerms.some((p) => !existingPerms.includes(p))
    ) {
      try {
        await this.permissionRepo.upsertUserPermissions(userId, userPermissions);
      } catch {
        // non-blocking
      }
    }

    let sellingEntityId: string | null = null;
    let entityStatus: string | null = null;

    const userRoleLower = (user.role || '').toLowerCase();
    const userRoleUpper = (user.role || '').toUpperCase();
    const isSellerRole =
      userRoleUpper === 'SELLER' ||
      userRoleUpper === 'COMPANY_ADMIN' ||
      userRoleLower === 'seller' ||
      userRoleLower === 'company_admin' ||
      userRoleLower === RolesEnum.SELLER.toLowerCase() ||
      userRoleLower === RolesEnum.COMPANY_ADMIN.toLowerCase();

    if (isSellerRole) {
      let sellingEntity = await this.sellingEntityRepo.getOne({
        primaryOwnerId: user._id,
      });

      if (!sellingEntity && user.sellingEntityId) {
        sellingEntity = await this.sellingEntityRepo.getOne({
          _id: user.sellingEntityId,
        });
      }

      if (sellingEntity) {
        sellingEntityId = sellingEntity._id ? sellingEntity._id.toString() : null;
        entityStatus = sellingEntity.status || null;

        if (!user.sellingEntityId && sellingEntity._id) {
          await this.userRepo.updateOne(
            { _id: user._id },
            { sellingEntityId: sellingEntity._id },
          );
        }
      }
    }

    const payload = {
      sub: userId,
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
      sellingEntityId,
      entityStatus,
      user: {
        id: userId,
        email: user.email,
        userName: user.userName,
        role: user.role,
        sellingEntityId,
        entityStatus,
        permissions: userPermissions,
      },
    };
  }

  async login(loginDto: LoginAuthDto, req?: any) {
    const { email, password, deviceInfo, ipAddress } = loginDto;
    console.log('[AUTH LOGIN] 1. Login started for email:', email);

    console.log('[AUTH LOGIN] 2. Querying user from DB...');
    const user = await this.userRepo.getOne({ email: email.toLowerCase() });
    console.log('[AUTH LOGIN] 2. User found in DB:', !!user, user?._id ? `(ID: ${user._id})` : '');
    if (!user || !user._id) {
      console.log('[AUTH LOGIN] Error: Invalid email or password (user not found)');
      throw new UnauthorizedException('Invalid email or password');
    }

    console.log('[AUTH LOGIN] 3. Comparing password hash...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('[AUTH LOGIN] 3. Password match result:', isPasswordValid);
    if (!isPasswordValid) {
      console.log('[AUTH LOGIN] Error: Invalid email or password (password mismatch)');
      throw new UnauthorizedException('Invalid email or password');
    }

    const status = user.status ?? AccountStatusEnum.ACTIVE;
    if (status !== AccountStatusEnum.ACTIVE) {
      console.log('[AUTH LOGIN] Error: Account status is', status);
      throw new ForbiddenException(
        `Account is ${status.toLowerCase()}. Access denied.`,
      );
    }

    if (user.role === RolesEnum.CUSTOMER && !user.isEmailVerified) {
      console.log('[AUTH LOGIN] Error: Customer email is not verified');
      throw new UnauthorizedException(
        'Email not verified. Please verify your email first.',
      );
    }

    const userIdStr = user._id.toString();
    console.log('[AUTH LOGIN] 4. Resolving user permissions for:', userIdStr);
    let userPermissions: string[] = [];
    try {
      const userPermissionsDoc = await this.permissionRepo.getOne({
        userId: userIdStr,
      });
      const defaultPerms = (getDefaultPermissionsForRole(user.role) as string[]) || [];
      const existingPerms =
        userPermissionsDoc?.permissions &&
        Array.isArray(userPermissionsDoc.permissions)
          ? userPermissionsDoc.permissions
          : [];
      userPermissions = Array.from(
        new Set([...existingPerms, ...defaultPerms]),
      );

      if (
        !userPermissionsDoc ||
        defaultPerms.some((p) => !existingPerms.includes(p))
      ) {
        this.permissionRepo.upsertUserPermissions(userIdStr, userPermissions).catch(() => {});
      }
    } catch (err: any) {
      console.log('[AUTH LOGIN] Warning during permissions query/upsert:', err?.message);
      userPermissions = (getDefaultPermissionsForRole(user.role) as string[]) || [];
    }
    console.log('[AUTH LOGIN] 4. Permissions resolved successfully. Count:', userPermissions.length);

    console.log('[AUTH LOGIN] 5. Checking selling entity association...');
    let sellingEntityId: string | null = null;
    let entityStatus: string | null = null;

    try {
      const userRoleLower = (user.role || '').toLowerCase();
      const userRoleUpper = (user.role || '').toUpperCase();
      const isSellerRole =
        userRoleUpper === 'SELLER' ||
        userRoleUpper === 'COMPANY_ADMIN' ||
        userRoleLower === 'seller' ||
        userRoleLower === 'company_admin' ||
        userRoleLower === RolesEnum.SELLER.toLowerCase() ||
        userRoleLower === RolesEnum.COMPANY_ADMIN.toLowerCase();

      if (isSellerRole) {
        let sellingEntity = await this.sellingEntityRepo.getOne({
          primaryOwnerId: user._id,
        });

        if (!sellingEntity && user.sellingEntityId) {
          sellingEntity = await this.sellingEntityRepo.getOne({
            _id: user.sellingEntityId,
          });
        }

        if (sellingEntity) {
          sellingEntityId = sellingEntity._id ? sellingEntity._id.toString() : null;
          entityStatus = sellingEntity.status || null;

          if (!user.sellingEntityId && sellingEntity._id) {
            this.userRepo.updateOne(
              { _id: user._id },
              { sellingEntityId: sellingEntity._id },
            ).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      console.log('[AUTH LOGIN] Warning during selling entity query:', err?.message);
    }
    console.log('[AUTH LOGIN] 5. Selling entity checked. ID:', sellingEntityId, 'Status:', entityStatus);

    console.log('[AUTH LOGIN] 6. Generating JWT tokens...');
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
    console.log('[AUTH LOGIN] 6. Tokens generated successfully');

    console.log('[AUTH LOGIN] 7. Hashing refresh token...');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const clientIp =
      req?.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      ipAddress ||
      '127.0.0.1';
    const clientDevice =
      req?.headers?.['user-agent'] ||
      deviceInfo ||
      'Web Browser';

    console.log('[AUTH LOGIN] 8. Creating session in database...');
    const session = await this.sessionRepo.create({
      userId: user._id,
      refreshTokenHash,
      deviceInfo: clientDevice,
      ipAddress: clientIp,
      isRevoked: false,
      expiresAt,
    });
    console.log('[AUTH LOGIN] 8. Session created successfully. Session ID:', session?._id);

    console.log('[AUTH LOGIN] 9. Login finished successfully. Returning response.');
    return {
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        accessToken,
        refreshToken,
        sessionId: session._id,
        user: {
          id: userIdStr,
          userName: user.userName,
          email: user.email,
          role: user.role,
          permissions: userPermissions,
          sellingEntityId: sellingEntityId || null,
          entityStatus: entityStatus || null,
        },
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
    const defaultPerms = (getDefaultPermissionsForRole(user.role) as string[]) || [];
    const existingPerms =
      userPermissionsDoc?.permissions &&
      Array.isArray(userPermissionsDoc.permissions)
        ? userPermissionsDoc.permissions
        : [];
    const userPermissions: string[] = Array.from(
      new Set([...existingPerms, ...defaultPerms]),
    );

    if (
      !userPermissionsDoc ||
      defaultPerms.some((p) => !existingPerms.includes(p))
    ) {
      try {
        await this.permissionRepo.upsertUserPermissions(userIdStr, userPermissions);
      } catch {
        // non-blocking
      }
    }

    let sellingEntityId: string | null = null;
    let entityStatus: string | null = null;

    const userRoleLower = (user.role || '').toLowerCase();
    const userRoleUpper = (user.role || '').toUpperCase();
    const isSellerRole =
      userRoleUpper === 'SELLER' ||
      userRoleUpper === 'COMPANY_ADMIN' ||
      userRoleLower === 'seller' ||
      userRoleLower === 'company_admin' ||
      userRoleLower === RolesEnum.SELLER.toLowerCase() ||
      userRoleLower === RolesEnum.COMPANY_ADMIN.toLowerCase();

    if (isSellerRole) {
      let sellingEntity = await this.sellingEntityRepo.getOne({
        primaryOwnerId: user._id,
      });

      if (!sellingEntity && user.sellingEntityId) {
        sellingEntity = await this.sellingEntityRepo.getOne({
          _id: user.sellingEntityId,
        });
      }

      if (sellingEntity) {
        sellingEntityId = sellingEntity._id ? sellingEntity._id.toString() : null;
        entityStatus = sellingEntity.status || null;

        if (!user.sellingEntityId && sellingEntity._id) {
          await this.userRepo.updateOne(
            { _id: user._id },
            { sellingEntityId: sellingEntity._id },
          );
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

  /**
   * طلب استعادة كلمة المرور عبر OTP مع تخزينه في Redis لمدة 10 دقائق (600 ثانية)
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepo.getOne({ email });
    if (!user) {
      throw new NotFoundException('لا يوجد مستخدم مسجل بهذا البريد الإلكتروني');
    }

    // توليد رمز OTP آمن مكون من 6 أرقام
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const cacheKey = `otp:reset-password:${email}`;

    // تخزين الرمز في Redis مع مدة صلاحية 600 ثانية (10 دقائق)
    await this.cacheManager.set(cacheKey, otp, 600 * 1000);

    // طباعة الرمز في السجل للتطوير والفحص
    this.logger.log(`[PASSWORD RESET] OTP generated for ${email}: ${otp} (valid for 10 minutes)`);

    // إرسال الرمز عبر البريد الإلكتروني للمستخدم
    try {
      await this.mailService.send({
        to: email,
        subject: 'رمز استعادة كلمة المرور - سوقنا',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
            <h2>استعادة كلمة المرور</h2>
            <p>مرحباً <strong>${user.userName || 'عزيزي العميل'}</strong>،</p>
            <p>لقد تلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك في منصة <strong>سوقنا</strong>.</p>
            <div style="background: #f1f5f9; padding: 15px; border-radius: 10px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; color: #2563eb; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px;">هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط. إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
          </div>
        `,
      });
    } catch (mailError) {
      this.logger.warn(`Failed to send reset password email to ${email}:`, mailError);
    }

    return {
      success: true,
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح (صالح لمدة 10 دقائق)',
    };
  }

  /**
   * التحقق من مطابقة رمز الـ OTP في Redis
   */
  async verifyResetOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const cacheKey = `otp:reset-password:${email}`;
    const storedOtp = await this.cacheManager.get<string>(cacheKey);

    if (!storedOtp || storedOtp.toString() !== dto.otp.toString()) {
      throw new BadRequestException('رمز التحقق غير صحيح أو انتهت صلاحيته');
    }

    return {
      success: true,
      message: 'رمز التحقق صحيح',
      email,
    };
  }

  /**
   * إعادة تعيين كلمة المرور بعد التحقق النهائي من الـ OTP وحذفه من Redis
   */
  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const cacheKey = `otp:reset-password:${email}`;
    const storedOtp = await this.cacheManager.get<string>(cacheKey);

    if (!storedOtp || storedOtp.toString() !== dto.otp.toString()) {
      throw new BadRequestException('رمز التحقق غير صحيح أو انتهت صلاحيته');
    }

    const user = await this.userRepo.getOne({ email });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // تشفير كلمة المرور الجديدة بـ Bcrypt (Salt rounds = 10)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    // تحديث كلمة المرور في قاعدة البيانات
    await this.userRepo.updateOne(
      { _id: user._id },
      { password: hashedPassword },
    );

    // حذف المفتاح من Redis فوراً لمنع إعادة استخدامه
    await this.cacheManager.del(cacheKey);

    this.logger.log(`Password reset successfully for ${email}`);

    return {
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    };
  }
}
