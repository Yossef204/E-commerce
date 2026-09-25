import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepo } from '../../models/user/user.repository';
import { Types } from 'mongoose';
import { FileUploadsService } from '../../shared/file-uploads/file-uploads.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly userRepo: UserRepo,
    private readonly fileUploadsService: FileUploadsService,
  ) {}
  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
  async updateProfilePic(userId: string, profilePicKey: string) {
    const objectId = new Types.ObjectId(userId);

    // 1. جلب المستخدم الحالي لمعرفة المفتاح القديم قبل الاستبدال
    const currentUser = await this.userRepo.getOne({ _id: objectId });
    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    const oldProfilePicKey = currentUser.profilePic;

    // 2. التحديث عبر Abstract Repository (التي ترجع المستند المحدث)
    const updatedUser = await this.userRepo.updateOne(
      { _id: objectId },
      { $set: { profilePic: profilePicKey } },
      { new: true },
    );

    // 3. حذف الملف القديم من S3 إذا كان مختلفاً وموجوداً
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
