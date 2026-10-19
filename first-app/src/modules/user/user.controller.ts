import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfilePicDto } from './dto/update-profile-pic.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { User } from '../../common/decorators/user.decorators';

@UseGuards(AuthenticationGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['users', 'user'])
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * جلب بيانات الملف الشخصي، العناوين، وسجل الطلبات
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@Request() req: any, @User('id') userId?: string) {
    const id = userId || req.user?.id || req.user?.sub;
    return this.userService.getProfile(id);
  }

  /**
   * تحديث الاسم، رقم الهاتف، والعناوين
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileDto,
    @User('id') userId?: string,
  ) {
    const id = userId || req.user?.id || req.user?.sub;
    return this.userService.updateProfile(id, dto);
  }

  /**
   * تغيير كلمة المرور للمستخدم المسجل
   */
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: any,
    @Body() dto: ChangePasswordDto,
    @User('id') userId?: string,
  ) {
    const id = userId || req.user?.id || req.user?.sub;
    return this.userService.changePassword(id, dto);
  }

  /**
   * تحديث صورة الملف الشخصي
   */
  @Patch('profile-pic')
  @HttpCode(HttpStatus.OK)
  async updateProfilePic(
    @Request() req: any,
    @Body() dto: UpdateProfilePicDto,
    @User('id') userId?: string,
  ) {
    const id = userId || req.user?.id || req.user?.sub;
    return this.userService.updateProfilePic(id, dto.profilePic);
  }
}
