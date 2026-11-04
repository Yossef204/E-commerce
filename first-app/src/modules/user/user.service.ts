import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  Optional,
  OnApplicationBootstrap,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UserRepo } from '../../models/user/user.repository';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { FileUploadsService } from '../../shared/file-uploads/file-uploads.service';
import { SessionRepo } from '../../models/session/session.repository';
import {
  CACHE_SERVICE,
  ICacheService,
} from '../../shared/cache/interfaces/cache-service.interface';
import { serializeSafeUser, serializeSafeUsers } from '../../common/utils/safe-user.serializer';
import {
  parseAndValidateTokenVersion,
  syncTokenVersionToCache,
} from '../../common/utils/token-version.util';
import { RolesEnum } from '../../common/enums/roles';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UserService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepo,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly fileUploadsService: FileUploadsService,
    @Optional() private readonly sessionRepo?: SessionRepo,
    @Optional()
    @Inject(CACHE_SERVICE)
    private readonly cacheService?: ICacheService,
  ) {}

  /**
   * Safe inline database normalization hook: ensures all legacy users in MongoDB
   * with mixed-case or uppercase roles are normalized to canonical lowercase.
   */
  async onApplicationBootstrap() {
    try {
      if (this.userRepo && typeof this.userRepo.updateMany === 'function') {
        await this.userRepo.updateMany(
          { role: { $regex: /^seller$/i, $ne: RolesEnum.SELLER } },
          { $set: { role: RolesEnum.SELLER } },
        );
        await this.userRepo.updateMany(
          { role: { $regex: /^admin$/i, $ne: RolesEnum.ADMIN } },
          { $set: { role: RolesEnum.ADMIN } },
        );
        await this.userRepo.updateMany(
          { role: { $regex: /^customer$/i, $ne: RolesEnum.CUSTOMER } },
          { $set: { role: RolesEnum.CUSTOMER } },
        );
        await this.userRepo.updateMany(
          { role: { $regex: /^company_admin$/i, $ne: RolesEnum.COMPANY_ADMIN } },
          { $set: { role: RolesEnum.COMPANY_ADMIN } },
        );
      }
    } catch {
      // Non-blocking during mock testing or before connection is established
    }
  }

  /**
   * جلب بيانات الملف الشخصي، العناوين، وسجل الطلبات
   */
  async getProfile(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('معرف المستخدم غير صالح');
    }

    const objectId = new Types.ObjectId(userId);
    const userDoc = await this.userRepo.getOne({ _id: objectId });
    if (!userDoc) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // جلب سجل طلبات العميل
    const orders = await this.mainOrderRepo.getAll(
      { customerId: objectId },
      undefined,
      { sort: { createdAt: -1 } },
    );

    const safeUser = serializeSafeUser(userDoc);

    return {
      success: true,
      user: safeUser,
      orders: orders || [],
    };
  }

  /**
   * تحديث بيانات الملف الشخصي (الاسم، الهاتف، العناوين)
   * يضمن حصر التعديل على هوية المستخدم الموثقة حصراً ومنع IDOR
   */
  async updateProfile(userId: string, dto: UpdateProfileDto | any, currentUser?: any) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('معرف المستخدم غير صالح');
    }

    const objectId = new Types.ObjectId(userId);

    // Reject tampering attempts when a payload targets a foreign user ID
    const targetPayloadId = dto?.userId || dto?.id || dto?._id || dto?.customerId;
    if (targetPayloadId && targetPayloadId.toString() !== userId.toString()) {
      const userRole = (currentUser?.role || '').toLowerCase();
      const isSuperAdmin =
        userRole === 'admin' ||
        userRole === 'super_admin' ||
        userRole === 'superadmin';
      if (!isSuperAdmin) {
        throw new ForbiddenException('غير مصرح لك بتعديل بيانات مستخدم آخر');
      }
    }

    const user = await this.userRepo.getOne({ _id: objectId });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const updateData: any = {};
    if (dto.userName && dto.userName.trim()) {
      updateData.userName = dto.userName.trim();
    }
    if (dto.phoneNumber !== undefined) {
      updateData.phoneNumber = dto.phoneNumber.trim();
    }
    if (dto.address !== undefined) {
      updateData.address = dto.address.trim();
    }
    if (dto.addresses !== undefined) {
      updateData.addresses = dto.addresses.map((a: string) => a.trim()).filter(Boolean);
    }

    const updatedUser = await this.userRepo.updateOne(
      { _id: objectId },
      { $set: updateData },
      { new: true },
    );

    const safeUser = serializeSafeUser(updatedUser);

    return {
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: safeUser,
    };
  }

  /**
   * تغيير كلمة المرور للمستخدم المسجل وإلغاء صلاحية الجلسات النشطة
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('معرف المستخدم غير صالح');
    }

    const objectId = new Types.ObjectId(userId);
    const user = await this.userRepo.getOne({ _id: objectId });
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // التحقق من كلمة المرور الحالية
    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    }

    // تشفير كلمة المرور الجديدة
    const saltRounds = 10;
    const newHashedPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    // تحديث كلمة المرور وزيادة tokenVersion في قاعدة البيانات ذرياً
    const updatedUser = await this.userRepo.updateOne(
      { _id: objectId },
      {
        $inc: { tokenVersion: 1 },
        $set: { password: newHashedPassword },
      },
      { new: true },
    );

    const newVersion = parseAndValidateTokenVersion(
      (updatedUser as any)?.tokenVersion !== undefined
        ? (updatedUser as any).tokenVersion
        : parseAndValidateTokenVersion((user as any).tokenVersion) + 1,
    );

    // تحديث tokenVersion في الكاش (Redis) لإلغاء جميع Access Tokens الحالية
    if (this.cacheService) {
      try {
        const idStr = objectId.toString();
        await syncTokenVersionToCache(this.cacheService, idStr, newVersion);
      } catch (cacheErr: any) {
        this.logger.warn(`Failed to update cache tokenVersion for user ${userId}: ${cacheErr?.message}`);
      }
    }

    // إلغاء جميع جلسات المستخدم النشطة في SessionRepo لإلغاء Refresh Tokens
    if (this.sessionRepo) {
      try {
        await this.sessionRepo.updateMany(
          { userId: objectId, isRevoked: false },
          {
            $set: {
              isRevoked: true,
              activeTokenHash: '',
              revocationReason: 'PASSWORD_CHANGED',
            },
          },
        );
      } catch (sessionErr: any) {
        this.logger.error(`Failed to revoke sessions for user ${userId}: ${sessionErr?.message}`);
      }
    }

    return {
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح وإلغاء جميع الجلسات السابقة',
    };
  }

  /**
   * تحديث صورة الملف الشخصي
   */
  async updateProfilePic(userId: string, profilePicKey: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('معرف المستخدم غير صالح');
    }

    const objectId = new Types.ObjectId(userId);

    const currentUser = await this.userRepo.getOne({ _id: objectId });
    if (!currentUser) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const oldProfilePicKey = currentUser.profilePic;

    const updatedUser = await this.userRepo.updateOne(
      { _id: objectId },
      { $set: { profilePic: profilePicKey } },
      { new: true },
    );

    if (oldProfilePicKey && oldProfilePicKey !== profilePicKey) {
      try {
        await this.fileUploadsService.deleteFile(oldProfilePicKey);
      } catch (error) {
        this.logger.error(
          `Failed to delete old avatar (${oldProfilePicKey}) from S3:`,
          error,
        );
      }
    }

    const safeUser = serializeSafeUser(updatedUser);

    return safeUser;
  }

  /**
   * جلب قائمة المستخدمين للإدارة مع دعم فلترة الدور (role)
   */
  async getAllUsers(role?: string) {
    const filter: any = {};
    if (role && role !== 'ALL') {
      filter.role = { $regex: new RegExp(`^${role}$`, 'i') };
    }
    const users = await this.userRepo.getAll(filter, undefined, {
      sort: { createdAt: -1 },
    });
    return serializeSafeUsers(users);
  }
}
