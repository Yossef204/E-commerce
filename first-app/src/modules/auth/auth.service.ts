import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { runSafeTransaction } from '../../common/utils/transaction.util';
import {
  CACHE_SERVICE,
  ICacheService,
} from '../../shared/cache/interfaces/cache-service.interface';
import {
  MAILER_SERVICE,
  IMailerService,
} from '../../shared/mailer/interfaces/mailer.interface';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { RegisterSellerAuthDto } from './dto/register-seller-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserRepo } from '../../models/user/user.repository';
import { CustomerRepo } from '../../models/customer/customer.repository';
import { SessionRepo } from '../../models/session/session.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RolesEnum } from '../../common/enums/roles';
import { AccountStatusEnum } from '../../common/enums/account-status';
import { EntityStatusEnum } from '../../common/enums/entity-status.enum';
import { EntityTypeEnum } from '../../common/enums/entity-type.enum';
import { PermissionRepo } from '../../models/permission/permission.repository';
import { getDefaultPermissionsForRole } from '../../common/enums/permissions.enum';
import { normalizePermissions } from '../../common/utils/permission-normalizer.util';
import { CryptoTokenUtil } from '../../common/utils/crypto-token.util';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import {
  parseAndValidateTokenVersion,
  syncTokenVersionToCache,
  getCachedTokenVersion,
} from '../../common/utils/token-version.util';
import { Types } from 'mongoose';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepo: UserRepo,
    private readonly customerRepo: CustomerRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly jwtService: JwtService,
    @Inject(MAILER_SERVICE) private readonly mailerService: IMailerService,
    private readonly configService: ConfigService,
    private readonly permissionRepo: PermissionRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    @Optional() @InjectConnection() private readonly connection?: Connection,
  ) {}

  async getUserTokenVersion(userId: string): Promise<number> {
    if (!userId) {
      throw new UnauthorizedException('Invalid user ID for token version retrieval');
    }

    // 1. Authoritative MongoDB Lookup
    let authoritativeVersion = 1;
    if (this.userRepo && Types.ObjectId.isValid(userId)) {
      try {
        const u = await this.userRepo.getOne({ _id: new Types.ObjectId(userId) });
        if (u) {
          authoritativeVersion = parseAndValidateTokenVersion(
            (u as any).tokenVersion,
            'dbTokenVersion',
          );
        }
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
      }
    }

    // 2. Synchronize to cache if missing or desynchronized (MongoDB is ground truth)
    try {
      const cached = await Promise.race([
        getCachedTokenVersion(this.cacheService, userId),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Cache Timeout')), 300),
        ),
      ]);

      if (cached !== authoritativeVersion) {
        await syncTokenVersionToCache(this.cacheService, userId, authoritativeVersion);
      }
    } catch {
      // Non-fatal: authoritative MongoDB remains ground truth
    }

    return authoritativeVersion;
  }

  async generateTokens(user: any, extraPayload: any = {}) {
    const userId = user._id || user.id;
    const userIdStr = userId ? userId.toString() : '';
    console.log('--> 6.1: Starting generateTokens for user:', userIdStr);

    console.log('--> 6.2: Resolving authoritative tokenVersion...');
    // Authoritative baseline strictly from MongoDB User document
    const authoritativeVersion = parseAndValidateTokenVersion(
      user.tokenVersion,
      'user.tokenVersion',
    );

    try {
      const cached = await Promise.race([
        getCachedTokenVersion(this.cacheService, userIdStr),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Cache Timeout')), 300),
        ),
      ]);

      // MongoDB is authoritative. If cache is missing or desynchronized, repair cache.
      if (cached !== authoritativeVersion) {
        await syncTokenVersionToCache(this.cacheService, userIdStr, authoritativeVersion);
      }
      console.log('--> 6.3: Token version verified and synchronized:', authoritativeVersion);
    } catch (err) {
      console.warn('--> 6.3: Cache skipped (Timeout or Error), using authoritative tokenVersion =', authoritativeVersion);
    }

    const tokenVersion = authoritativeVersion;

    const jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      this.configService.get<any>('jwt')?.accessSecret ||
      this.configService.get<string>('jwt.accessSecret') ||
      process.env.ACCESS_TOKEN_SECRET ||
      'default_jwt_secret_fallback';

    console.log('--> 6.4: Signing Access Token...');
    const accessPayload = {
      id: userIdStr,
      sub: userIdStr,
      email: user.email,
      role: (user.role || RolesEnum.CUSTOMER).toLowerCase().trim(),
      tokenType: 'access',
      sellingEntityId:
        extraPayload?.sellingEntityId ||
        (user.sellingEntityId ? user.sellingEntityId.toString() : undefined),
      entityStatus: extraPayload?.entityStatus || undefined,
      permissions: extraPayload?.permissions || [],
      tokenVersion,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: jwtSecret,
      expiresIn: '1d',
    });

    console.log('--> 6.5: Signing Refresh Token...');
    const jti = extraPayload?.jti || CryptoTokenUtil.generateJti();
    const refreshPayload = {
      id: userIdStr,
      sub: userIdStr,
      tokenVersion,
      tokenType: 'refresh',
      jti,
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: jwtSecret,
      expiresIn: '7d',
    });

    console.log('--> 6.6: Tokens generated successfully');
    return { accessToken, refreshToken, tokenVersion, jti };
  }

  private getScopedPermissionsForEntity(
    isSellerRole: boolean,
    entityStatus: string | null | undefined,
    allPermissions: string[],
  ): string[] {
    if (!isSellerRole) {
      return allPermissions;
    }
    const normalizedStatus = (entityStatus || '').toUpperCase().trim();
    const isApproved =
      normalizedStatus === EntityStatusEnum.APPROVED ||
      normalizedStatus === EntityStatusEnum.ACTIVE;

    if (isApproved) {
      return allPermissions;
    }

    // Unapproved merchant (PENDING_APPROVAL, REJECTED, SUSPENDED, DEACTIVATED):
    // strictly onboarding permissions only (no product.*, order.*, inventory.*, payout.*)
    return [
      'profile.read',
      'profile.read_own',
      'profile.update_own',
      'entity.read_own',
      'selling_entity.read_own',
    ];
  }

  async invalidateUserToken(userId: string): Promise<void> {
    try {
      if (!userId || !Types.ObjectId.isValid(userId)) return;

      let authoritativeVersion: number;

      // 1. Atomically increment tokenVersion in authoritative MongoDB User document
      if (this.userRepo) {
        const updatedUser = await this.userRepo.updateOne(
          { _id: new Types.ObjectId(userId) },
          { $inc: { tokenVersion: 1 } },
          { new: true },
        );
        if (updatedUser && (updatedUser as any).tokenVersion !== undefined) {
          authoritativeVersion = parseAndValidateTokenVersion((updatedUser as any).tokenVersion);
        } else {
          const u = await this.userRepo.getOne({ _id: new Types.ObjectId(userId) });
          authoritativeVersion = parseAndValidateTokenVersion((u as any)?.tokenVersion);
        }
      } else {
        authoritativeVersion = 1;
      }

      // 2. Synchronize across canonical cache keys without duplicate increments
      await syncTokenVersionToCache(this.cacheService, userId, authoritativeVersion);
      this.logger.log(`Token version incremented to ${authoritativeVersion} for user: ${userId}`);
    } catch (err: any) {
      this.logger.warn(
        `Failed to increment token version for ${userId}: ${err?.message}`,
      );
    }
  }

  async register(registerAuthDto: RegisterAuthDto ) {
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

    const userRole: RolesEnum = RolesEnum.CUSTOMER;
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
      const defaultPerms = normalizePermissions(
        getDefaultPermissionsForRole(userRole),
        userRole,
      );
      await this.permissionRepo.upsertUserPermissions(userId, [...defaultPerms]);
    }

    await this.mailerService.send({
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

  async registerSeller(dto: RegisterSellerAuthDto) {
    const {
      userName,
      email,
      password,
      phoneNumber,
      role,
      storeName,
      description,
      taxOrCommercialNumber,
      documentUrl,
    } = dto;

    // 1. فحص عدم تكرار البريد التجاري
    const existingUser = await this.userRepo.getOne({
      email: email.toLowerCase(),
    });
    if (existingUser) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    // 2. فحص عدم تكرار اسم المتجر
    const trimmedStoreName = storeName.trim();
    const existingEntity = await this.sellingEntityRepo.getOne({
      $or: [
        { legalName: { $regex: new RegExp(`^${trimmedStoreName}$`, 'i') } },
        { tradeName: { $regex: new RegExp(`^${trimmedStoreName}$`, 'i') } },
      ],
    });
    if (existingEntity) {
      throw new ConflictException('اسم المتجر مستخدم بالفعل');
    }

    // 3. تحديد الدور ونوع الكيان التجاري
    const normalizedRole: RolesEnum =
      role === RolesEnum.COMPANY_ADMIN ||
      (role as string)?.toLowerCase() === 'company_admin'
        ? RolesEnum.COMPANY_ADMIN
        : RolesEnum.SELLER;

    const entityType: EntityTypeEnum =
      normalizedRole === RolesEnum.COMPANY_ADMIN
        ? EntityTypeEnum.COMPANY
        : EntityTypeEnum.INDEPENDENT_SELLER;

    // 4. تشفير كلمة المرور وتوليد OTP
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, saltRounds);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const targetUserId = new Types.ObjectId();

    // 5. إنشاء كائن SellingEntity بحالة PENDING_APPROVAL
    const sellingEntity = await this.sellingEntityRepo.create({
      legalName: trimmedStoreName,
      tradeName: trimmedStoreName,
      type: entityType,
      status: EntityStatusEnum.PENDING_APPROVAL,
      primaryOwnerId: targetUserId,
      description: description || null,
      documentUrl: documentUrl || null,
      businessDetails: {
        taxNumber: taxOrCommercialNumber || null,
        commercialRegister: taxOrCommercialNumber || null,
        phone: phoneNumber,
        address: description || null,
      },
      commissionPercentage: 10,
      commissionFixedFee: 0,
    });

    // 6. إنشاء المستخدم وربطه بالـ sellingEntityId
    const createdUser = await this.userRepo.create({
      _id: targetUserId,
      userName,
      email: email.toLowerCase(),
      phoneNumber,
      password: hashedPassword,
      role: normalizedRole,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: otpExpiresAt,
      sellingEntityId: sellingEntity._id,
    });

    const actualUserId = createdUser._id || targetUserId;

    // 7. ربط الكيان التجاري بالمستخدم الفعلي كـ primaryOwnerId
    await this.sellingEntityRepo.updateOne(
      { _id: sellingEntity._id },
      { primaryOwnerId: actualUserId },
    );

    // 8. حقن الصلاحيات الافتراضية للدور
    const defaultPerms = normalizePermissions(
      getDefaultPermissionsForRole(normalizedRole),
      normalizedRole,
    );
    await this.permissionRepo.upsertUserPermissions(
      actualUserId.toString(),
      [...defaultPerms],
    );

    // 9. إرسال بريد الـ OTP للتحقق
    await this.mailerService.send({
      to: email,
      subject: 'تأكيد التسجيل كبائع / شركة - رمز التحقق',
      html: `<p>مرحباً <strong>${userName}</strong>،</p><p>رمز التحقق الخاص بك لتفعيل متجر <strong>${trimmedStoreName}</strong> هو: <strong>${otp}</strong></p><p>ينتهي هذا الرمز خلال 10 دقائق.</p>`,
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
        'تم تسجيل المتجر بنجاح. يرجى تأكيد البريد الإلكتروني باستخدام رمز التحقق المرسل.',
      user: userResponse,
      sellingEntity: {
        id: sellingEntity._id,
        storeName: trimmedStoreName,
        status: EntityStatusEnum.PENDING_APPROVAL,
      },
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
          role: (user.role || RolesEnum.CUSTOMER).toLowerCase().trim(),
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
    const defaultPerms = getDefaultPermissionsForRole(user.role || RolesEnum.CUSTOMER);
    const existingPerms =
      existingPermsDoc?.permissions &&
      Array.isArray(existingPermsDoc.permissions)
        ? existingPermsDoc.permissions
        : [];
    const normalized = normalizePermissions(
      [...existingPerms, ...defaultPerms],
      user.role,
    );
    const userPermissions: string[] = [...normalized];

    const needsDbSync =
      !existingPermsDoc ||
      normalized.hasChanges ||
      normalized.length !== existingPerms.length ||
      normalized.some((p) => !existingPerms.includes(p));

    if (needsDbSync) {
      this.permissionRepo
        .upsertUserPermissions(userId, userPermissions)
        .catch(() => {});
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

    const tokenPermissions = this.getScopedPermissionsForEntity(
      isSellerRole,
      entityStatus,
      userPermissions,
    );

    const { accessToken, refreshToken } = await this.generateTokens(user, {
      sellingEntityId,
      entityStatus,
      permissions: tokenPermissions,
    });

    const activeTokenHash = CryptoTokenUtil.hashToken(refreshToken);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.sessionRepo.create({
      userId: user._id,
      activeTokenHash,
      refreshTokenHash,
      consumedTokenHashes: [],
      revocationReason: null,
      deviceInfo: 'Web Browser',
      userAgent: 'Web Browser',
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
        role: (user.role || RolesEnum.CUSTOMER).toLowerCase().trim(),
        sellingEntityId,
        entityStatus,
        permissions: tokenPermissions,
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

    const userRole = (user.role || RolesEnum.CUSTOMER).toLowerCase().trim() as RolesEnum;

    if (userRole === RolesEnum.CUSTOMER && !user.isEmailVerified) {
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
      const defaultPerms = getDefaultPermissionsForRole(userRole);
      const existingPerms =
        userPermissionsDoc?.permissions &&
        Array.isArray(userPermissionsDoc.permissions)
          ? userPermissionsDoc.permissions
          : [];
      const normalized = normalizePermissions(
        [...existingPerms, ...defaultPerms],
        userRole,
      );
      userPermissions = [...normalized];

      const needsDbSync =
        !userPermissionsDoc ||
        normalized.hasChanges ||
        normalized.length !== existingPerms.length ||
        normalized.some((p) => !existingPerms.includes(p));

      if (needsDbSync) {
        this.permissionRepo
          .upsertUserPermissions(userIdStr, userPermissions)
          .catch(() => {});
      }
    } catch (err: any) {
      console.log('[AUTH LOGIN] Warning during permissions query/upsert:', err?.message);
      userPermissions = [...normalizePermissions(getDefaultPermissionsForRole(userRole), userRole)];
    }
    console.log('[AUTH LOGIN] 4. Permissions resolved successfully. Count:', userPermissions.length);

    console.log('[AUTH LOGIN] 5. Checking selling entity association...');
    let sellingEntityId: string | null = null;
    let entityStatus: string | null = null;
    let isSellerRole = false;

    try {
      const userRoleLower = (user.role || '').toLowerCase();
      const userRoleUpper = (user.role || '').toUpperCase();
      isSellerRole =
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

    const tokenPermissions = this.getScopedPermissionsForEntity(
      isSellerRole,
      entityStatus,
      userPermissions,
    );

    console.log('[AUTH LOGIN] 6. Generating JWT tokens...');
    const { accessToken, refreshToken } = await this.generateTokens(user, {
      sellingEntityId:
        sellingEntityId ||
        (user.sellingEntityId ? user.sellingEntityId.toString() : undefined),
      entityStatus: entityStatus || undefined,
      permissions: tokenPermissions,
    });
    console.log('[AUTH LOGIN] 6. Tokens generated successfully');

    const activeTokenHash = CryptoTokenUtil.hashToken(refreshToken);
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
      activeTokenHash,
      refreshTokenHash,
      consumedTokenHashes: [],
      revocationReason: null,
      deviceInfo: clientDevice,
      userAgent: clientDevice,
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
          role: (user.role || RolesEnum.CUSTOMER).toLowerCase().trim(),
          permissions: tokenPermissions,
          sellingEntityId: sellingEntityId || null,
          entityStatus: entityStatus || null,
        },
      },
    };
  }

  async refreshToken(
    input: RefreshTokenDto | string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const rawRefreshToken =
      typeof input === 'string' ? input : input?.refreshToken;
    const effectiveIp =
      ipAddress ||
      (typeof input === 'object' ? input.ipAddress : undefined) ||
      '127.0.0.1';
    const effectiveUserAgent =
      userAgent ||
      (typeof input === 'object' ? input.deviceInfo : undefined) ||
      'Web Browser';

    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token is required');
    }

    const jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      this.configService.get<any>('jwt')?.accessSecret ||
      this.configService.get<string>('jwt.accessSecret') ||
      process.env.ACCESS_TOKEN_SECRET ||
      'default_jwt_secret_fallback';

    // 1. Cryptographic Validation
    let payload: any;
    try {
      if (typeof this.jwtService.verifyAsync === 'function') {
        payload = await this.jwtService.verifyAsync(rawRefreshToken, {
          secret: jwtSecret,
        });
      } else {
        payload = this.jwtService.verify(rawRefreshToken, {
          secret: jwtSecret,
        });
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Confirm payload.tokenType === 'refresh'
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException(
        'Invalid token type. Refresh token required.',
      );
    }

    // 2. Identity & Account Check
    const userId = payload.sub || payload.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid token credentials');
    }

    const user = await this.userRepo.getOne({
      _id: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
    });
    if (
      !user ||
      !user._id ||
      (user.status && user.status !== AccountStatusEnum.ACTIVE)
    ) {
      throw new UnauthorizedException('User account is inactive or deleted');
    }

    if (payload.tokenVersion !== undefined) {
      const incomingVersion = parseAndValidateTokenVersion(
        payload.tokenVersion,
        'refreshTokenPayload.tokenVersion',
      );
      const authoritativeVersion = parseAndValidateTokenVersion(
        user.tokenVersion,
        'dbTokenVersion',
      );
      if (incomingVersion !== authoritativeVersion) {
        throw new UnauthorizedException('Session is invalid or has been revoked');
      }
    }

    // 3. Reuse Detection (Compromise Alert)
    const incomingTokenHash = CryptoTokenUtil.hashToken(rawRefreshToken);

    // Query if incomingTokenHash exists in consumedTokenHashes for this session family
    const compromisedSession = await this.sessionRepo.getOne({
      consumedTokenHashes: incomingTokenHash,
    });

    if (compromisedSession) {
      // Mark the session immediately as isRevoked: true with revocationReason
      await this.sessionRepo.updateOne(
        { _id: compromisedSession._id },
        {
          $set: {
            isRevoked: true,
            activeTokenHash: '',
            revocationReason: 'SECURITY_ALERT: REFRESH_TOKEN_REUSE_DETECTED',
          },
        },
      );
      this.logger.error(
        `[SECURITY ALERT] Refresh token reuse detected for user ${userId}. Session family ${compromisedSession._id} revoked!`,
      );
      throw new UnauthorizedException(
        'Token already used. Session has been revoked for security.',
      );
    }

    // 4. Session & Hash Validation
    let existingSession = await this.sessionRepo.getOne({
      userId: user._id,
      activeTokenHash: incomingTokenHash,
    });

    // Backward-compatibility fallback for legacy sessions
    if (!existingSession) {
      const activeSessions = await this.sessionRepo.getAll({
        userId: user._id,
        isRevoked: false,
      });
      for (const s of activeSessions) {
        if (s.refreshTokenHash === incomingTokenHash) {
          existingSession = s;
          break;
        }
        if (s.refreshTokenHash) {
          const match = await bcrypt
            .compare(rawRefreshToken, s.refreshTokenHash)
            .catch(() => false);
          if (match) {
            existingSession = s;
            break;
          }
        }
      }
    }

    if (!existingSession) {
      throw new UnauthorizedException('Session is invalid or has been revoked');
    }

    if (existingSession.isRevoked) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (
      existingSession.expiresAt &&
      new Date(existingSession.expiresAt).getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Session has expired');
    }

    // 5. Atomic Exchange (Concurrency & Race Condition Guard)
    const userIdStr = user._id.toString();
    const userPermissionsDoc = await this.permissionRepo.getOne({
      userId: userIdStr,
    });
    const defaultPerms = getDefaultPermissionsForRole(user.role);
    const existingPerms =
      userPermissionsDoc?.permissions &&
      Array.isArray(userPermissionsDoc.permissions)
        ? userPermissionsDoc.permissions
        : [];
    const normalized = normalizePermissions(
      [...existingPerms, ...defaultPerms],
      user.role,
    );
    const userPermissions: string[] = [...normalized];

    const needsDbSync =
      !userPermissionsDoc ||
      normalized.hasChanges ||
      normalized.length !== existingPerms.length ||
      normalized.some((p) => !existingPerms.includes(p));

    if (needsDbSync) {
      this.permissionRepo
        .upsertUserPermissions(userIdStr, userPermissions)
        .catch(() => {});
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

    const newJti = CryptoTokenUtil.generateJti();

    const tokenPermissions = this.getScopedPermissionsForEntity(
      isSellerRole,
      entityStatus,
      userPermissions,
    );

    // Generate new Access and Refresh tokens with updated claims and JTI
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await this.generateTokens(user, {
        sellingEntityId:
          sellingEntityId ||
          (user.sellingEntityId ? user.sellingEntityId.toString() : undefined),
        entityStatus: entityStatus || undefined,
        permissions: tokenPermissions,
        jti: newJti,
      });

    const newActiveTokenHash = CryptoTokenUtil.hashToken(newRefreshToken);

    // Conditional Atomic Lock on { _id, isRevoked: false, activeTokenHash: incomingTokenHash }
    const sessionModel = this.sessionRepo.model;
    const filterLock: any = {
      _id: existingSession._id,
      isRevoked: false,
    };
    if (existingSession.activeTokenHash) {
      filterLock.activeTokenHash = incomingTokenHash;
    }

    const updateOps: any = {
      $set: {
        activeTokenHash: newActiveTokenHash,
        refreshTokenHash: newActiveTokenHash,
        ipAddress: effectiveIp,
        userAgent: effectiveUserAgent,
        deviceInfo: effectiveUserAgent,
      },
      $push: {
        consumedTokenHashes: {
          $each: [incomingTokenHash],
          $slice: -50,
        },
      },
    };

    let updatedSession: any = null;
    if (sessionModel && typeof sessionModel.findOneAndUpdate === 'function') {
      updatedSession = await sessionModel.findOneAndUpdate(
        filterLock,
        updateOps,
        { new: true },
      ).exec();
    } else {
      updatedSession = await this.sessionRepo.updateOne(
        filterLock,
        updateOps,
        { new: true },
      );
    }

    if (!updatedSession) {
      throw new UnauthorizedException('Token rotation conflict');
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: existingSession._id,
      sellingEntityId,
      entityStatus,
      user: {
        id: userIdStr,
        email: user.email,
        userName: user.userName,
        role: (user.role || RolesEnum.CUSTOMER).toLowerCase().trim(),
        sellingEntityId,
        entityStatus,
        permissions: userPermissions,
      },
    };
  }

  async logout(sessionId: string, userId?: string) {
    const filter: any = { _id: sessionId };
    if (userId) filter.userId = userId;
    const session = await this.sessionRepo.getOne(filter);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepo.updateOne(
      { _id: sessionId },
      {
        $set: {
          isRevoked: true,
          activeTokenHash: '',
          revocationReason: 'USER_LOGOUT',
        },
      },
    );

    return {
      success: true,
      message: 'Logged out successfully from session',
    };
  }

  async logoutAllDevices(userId: string) {
    await this.sessionRepo.updateMany(
      { userId, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          activeTokenHash: '',
          revocationReason: 'USER_LOGOUT_ALL',
        },
      },
    );

    await this.invalidateUserToken(userId);

    return {
      success: true,
      message: 'Logged out from all devices successfully',
    };
  }

  async logoutAll(userId: string) {
    return this.logoutAllDevices(userId);
  }

  /**
   * طلب استعادة كلمة المرور عبر OTP مع تشفير الرمز بـ SHA-256 وحماية من تعداد البريد والتوقيت
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const email = dto.email.toLowerCase().trim();
    const genericResponse = {
      success: true,
      message: 'إذا كان البريد الإلكتروني مسجلاً، فقد تم إرسال رمز التحقق.',
    };

    // 1. Resend Cooldown & Abuse Protection (60 seconds)
    const cooldownKey = `cooldown:reset:${email}`;
    const isInCooldown = await this.cacheService.get<boolean | string>(
      cooldownKey,
    );
    if (isInCooldown) {
      return genericResponse;
    }

    // 2. Query user from DB
    const user = await this.userRepo.getOne({ email });

    if (!user) {
      // Protect against timing attacks using constant-time dummy bcrypt hash
      await bcrypt.hash('dummy_timing_pad_salt_for_constant_time', 10);
      return genericResponse;
    }

    // Set 60-second cooldown per email
    await this.cacheService.set(cooldownKey, true, 60);

    // 3. Cryptographically secure 6-digit numeric OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto
      .createHash('sha256')
      .update(rawOtp)
      .digest('hex');
    const cacheKey = `otp:reset-password:${email}`;

    // Invalidate any previously existing OTP key for that email before setting the new one
    await this.cacheService.del(cacheKey);

    // Store the OTP in Cache exclusively as SHA-256 hash with 10-minute TTL (600s)
    await this.cacheService.set(cacheKey, otpHash, 600);

    // Security Logging: NEVER log plaintext OTP, passwords, or tokens
    this.logger.log(
      `[PASSWORD RESET] Verification OTP requested for email: ${email}`,
    );

    const htmlContent = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
        <h2>استعادة كلمة المرور</h2>
        <p>مرحباً <strong>${user.userName || 'عزيزي العميل'}</strong>،</p>
        <p>لقد تلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك في منصة <strong>سوقنا</strong>.</p>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 10px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; color: #2563eb; margin: 20px 0;">
          ${rawOtp}
        </div>
        <p style="color: #64748b; font-size: 13px;">هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط. إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
      </div>
    `;

    // Fire-and-forget email dispatch
    this.mailerService
      .send({
        to: email,
        subject: 'رمز استعادة كلمة المرور - سوقنا',
        html: htmlContent,
      })
      .catch((err: any) => {
        this.logger.warn(
          `Failed to dispatch reset email to ${email}: ${err?.message || err}`,
        );
      });

    return genericResponse;
  }

  /**
   * الخطوة الأولى: التحقق من رمز الـ OTP وإصدار رمز استعادة موقع ومؤقت مع تتبع jti (Single-Use)
   */
  async verifyResetOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const incomingOtp = dto.otp ? dto.otp.toString().trim() : '';
    const cacheKey = `otp:reset-password:${email}`;
    const attemptsKey = `otp:attempts:${email}`;

    // 1. فحص سقف محاولات التحقق الفاشلة (Defense Against Enumeration & Brute-Force)
    const attempts = (await this.cacheService.get<number>(attemptsKey)) || 0;
    if (attempts >= 5) {
      await this.cacheService.del(cacheKey);
      throw new BadRequestException(
        'لقد تجاوزت الحد الأقصى للمحاولات المسموح بها.',
      );
    }

    // 2. جلب الرمز المخزن ومقارنته بتجزئة SHA-256
    const storedOtp = await this.cacheService.get<string | number>(cacheKey);
    const incomingOtpHash = crypto
      .createHash('sha256')
      .update(incomingOtp)
      .digest('hex');

    const isMatch =
      storedOtp &&
      (storedOtp.toString().trim() === incomingOtpHash ||
        storedOtp.toString().trim() === incomingOtp);

    if (!isMatch) {
      const newAttempts = Number(attempts) + 1;
      await this.cacheService.set(attemptsKey, newAttempts, 600);

      if (newAttempts >= 5) {
        await this.cacheService.del(cacheKey);
        throw new BadRequestException(
          'لقد تجاوزت الحد الأقصى للمحاولات المسموح بها.',
        );
      }

      const remaining = 5 - newAttempts;
      throw new BadRequestException(
        `رمز التحقق غير صحيح أو انتهت صلاحيته. متبقي لديك ${remaining} محاولات.`,
      );
    }

    // 3. التحقق الناجح: مسح الرمز وعداد المحاولات فوراً لضمان الاستخدام لمرة واحدة فقط (Atomic cleanup / Single-Use)
    await this.cacheService.del(cacheKey);
    await this.cacheService.del(attemptsKey);

    // 4. توليد المعرف الفريد وتجزئته وتخزينه في الكاش (Single-Use Token Tracking)
    const jti = crypto.randomUUID();
    const jtiHash = crypto.createHash('sha256').update(jti).digest('hex');
    await this.cacheService.set(`reset:valid:${jtiHash}`, email, 900);

    // 5. توليد رمز استعادة كلمة المرور الموقع تشفيرياً مع jti (15 دقيقة)
    const resetSecret =
      this.configService.get<string>('JWT_RESET_SECRET') ||
      process.env.JWT_RESET_SECRET ||
      this.configService.get<string>('JWT_SECRET') ||
      this.configService.get<any>('jwt')?.accessSecret ||
      process.env.ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      'default_jwt_secret_fallback';

    const resetToken = await this.jwtService.signAsync(
      { email, jti, purpose: 'password_reset' },
      { secret: resetSecret, expiresIn: '15m' },
    );

    this.logger.log(
      `[PASSWORD RESET] OTP verified successfully and resetToken issued for ${email}`,
    );

    return {
      success: true,
      message: 'رمز التحقق صحيح',
      email,
      resetToken,
      data: {
        resetToken,
      },
    };
  }

  /**
   * الخطوة الثانية: إعادة تعيين كلمة المرور
   * مع فحص عدم تكرار كلمة المرور السابقة، وإبطال شامل عبر ترانزاكشن وكاش
   */
  async resetPassword(
    email: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }>;
  async resetPassword(
    dto: ResetPasswordDto & { email?: string; resetToken?: string },
  ): Promise<{ success: boolean; message: string }>;
  async resetPassword(
    emailOrDto: string | (ResetPasswordDto & { email?: string; resetToken?: string }),
    maybeNewPassword?: string,
  ): Promise<{ success: boolean; message: string }> {
    let email: string;
    let newPassword: string;

    if (typeof emailOrDto === 'string') {
      email = emailOrDto.toLowerCase().trim();
      newPassword = maybeNewPassword!;
    } else {
      const dto = emailOrDto;
      newPassword = dto.newPassword;
      if (dto.email) {
        email = dto.email.toLowerCase().trim();
      } else if (dto.resetToken) {
        const resetSecret =
          this.configService.get<string>('JWT_RESET_SECRET') ||
          process.env.JWT_RESET_SECRET ||
          this.configService.get<string>('JWT_SECRET') ||
          this.configService.get<any>('jwt')?.accessSecret ||
          process.env.ACCESS_TOKEN_SECRET ||
          process.env.JWT_SECRET ||
          'default_jwt_secret_fallback';

        let payload: any;
        try {
          payload = await this.jwtService.verifyAsync(dto.resetToken, {
            secret: resetSecret,
          });
        } catch {
          throw new UnauthorizedException(
            'رمز استعادة كلمة المرور غير صالح أو منتهي الصلاحية',
          );
        }

        if (!payload || payload.purpose !== 'password_reset' || !payload.email) {
          throw new UnauthorizedException(
            'رمز استعادة كلمة المرور غير صالح أو الغرض غير متطابق',
          );
        }

        if (payload.jti) {
          const jtiHash = crypto
            .createHash('sha256')
            .update(payload.jti)
            .digest('hex');
          const validKey = `reset:valid:${jtiHash}`;
          const isValid = await this.cacheService.get(validKey);
          if (!isValid) {
            throw new UnauthorizedException(
              'تم استخدام رمز الاستعادة مسبقاً أو تم إبطاله',
            );
          }
          await this.cacheService.del(validKey);
        }

        email = payload.email.toLowerCase().trim();
      } else {
        throw new BadRequestException(
          'البريد الإلكتروني مطلوب لإعادة تعيين كلمة المرور',
        );
      }
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('يجب ألا تقل كلمة المرور عن 8 أحرف أو أرقام');
    }

    // 1. التحقق من وجود المستخدم
    const user = await this.userRepo.getOne({ email });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // 2. التحقق من عدم استخدام نفس كلمة المرور السابقة (Old Password Rejection)
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('لا يمكن استخدام نفس كلمة المرور السابقة.');
    }

    // 3. تشفير كلمة المرور الجديدة بـ Bcrypt (Salt rounds = 12)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 4. تنفيذ العمليات الذرية عبر Transaction لقاعدة البيانات
    const executeMutations = async (session?: any) => {
      if (session) {
        await this.userRepo.updateOne(
          { _id: user._id },
          {
            password: hashedPassword,
            $inc: { tokenVersion: 1 },
          },
          { session },
        );
        await this.sessionRepo.updateMany(
          { userId: user._id, isRevoked: false },
          {
            $set: {
              isRevoked: true,
              activeTokenHash: '',
              revocationReason: 'PASSWORD_RESET_GLOBAL_REVOCATION',
              revokedReason: 'PASSWORD_RESET_GLOBAL_REVOCATION',
            },
          },
          { session },
        );
      } else {
        await this.userRepo.updateOne(
          { _id: user._id },
          {
            password: hashedPassword,
            $inc: { tokenVersion: 1 },
          },
        );
        await this.sessionRepo.updateMany(
          { userId: user._id, isRevoked: false },
          {
            $set: {
              isRevoked: true,
              activeTokenHash: '',
              revocationReason: 'PASSWORD_RESET_GLOBAL_REVOCATION',
              revokedReason: 'PASSWORD_RESET_GLOBAL_REVOCATION',
            },
          },
        );
      }
    };

    if (this.connection) {
      await runSafeTransaction(this.connection, executeMutations, this.logger);
    } else {
      await executeMutations(undefined);
    }

    // 5. رفع وتحديث رقم إصدار التوكن (tokenVersion) في الكاش لإبطال كافة الـ Access Tokens الفعالة
    let nextTokenVersion: number;
    const updatedUserDoc = await this.userRepo.getOne({ _id: user._id });
    if (updatedUserDoc && (updatedUserDoc as any).tokenVersion !== undefined) {
      nextTokenVersion = parseAndValidateTokenVersion((updatedUserDoc as any).tokenVersion);
    } else {
      nextTokenVersion = parseAndValidateTokenVersion(user.tokenVersion) + 1;
    }
    await syncTokenVersionToCache(this.cacheService, user._id.toString(), nextTokenVersion);

    this.logger.log(
      `Password reset successfully for ${email}. All previous sessions and tokens globally invalidated.`,
    );

    return {
      success: true,
      message:
        'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    };
  }
}
