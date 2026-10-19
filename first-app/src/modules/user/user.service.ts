import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UserRepo } from '../../models/user/user.repository';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { FileUploadsService } from '../../shared/file-uploads/file-uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepo,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly fileUploadsService: FileUploadsService,
  ) {}

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

    const rawUser = (userDoc as any).toObject ? (userDoc as any).toObject() : userDoc;
    const {
      password,
      emailVerificationOtpHash,
      emailVerificationOtpExpiresAt,
      ...safeUser
    } = rawUser;

    return {
      success: true,
      user: safeUser,
      orders: orders || [],
    };
  }

  /**
   * تحديث بيانات الملف الشخصي (الاسم، الهاتف، العناوين)
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('معرف المستخدم غير صالح');
    }

    const objectId = new Types.ObjectId(userId);
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
      updateData.addresses = dto.addresses.map((a) => a.trim()).filter(Boolean);
    }

    const updatedUser = await this.userRepo.updateOne(
      { _id: objectId },
      { $set: updateData },
      { new: true },
    );

    const rawUser = (updatedUser as any).toObject
      ? (updatedUser as any).toObject()
      : updatedUser;
    const { password, ...safeUser } = rawUser;

    return {
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: safeUser,
    };
  }

  /**
   * تغيير كلمة المرور للمستخدم المسجل
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

    await this.userRepo.updateOne(
      { _id: objectId },
      { password: newHashedPassword },
    );

    return {
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
    };
  }

  /**
   * تحديث صورة الملف الشخصي
   */
  async updateProfilePic(userId: string, profilePicKey: string) {
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

    return updatedUser;
  }
}
