import {
  Body,
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Patch,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfilePicDto } from './dto/update-profile-pic.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { User } from '../../common/decorators/user.decorators';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AllowPendingEntity } from '../../common/decorators/allow-pending-entity.decorator';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@ApiTags('Permissions & User Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * جلب قائمة كافة المستخدمين للمسؤولين والسوبر أدمن
   */
  @permissions(Permission.USER_MANAGE)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all platform users',
    description: 'Admin endpoint to view all registered customers, vendors, and staff with optional role filter',
  })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role (CUSTOMER, SELLER, ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Users list retrieved' })
  async getAllUsers(@Query('role') role?: string) {
    const data = await this.userService.getAllUsers(role);
    return {
      success: true,
      data,
    };
  }

  /**
   * جلب بيانات الملف الشخصي، العناوين، وسجل الطلبات
   */
  @AllowPendingEntity()
  @permissions(Permission.PROFILE_READ)
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieves authenticated user details, permissions, addresses, and account status',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'User profile retrieved' })
  async getProfile(@Request() req: any, @User('id') userId?: string) {
    const id = userId || req.user?.id || req.user?.sub;
    return this.userService.getProfile(id);
  }

  /**
   * تحديث الاسم، رقم الهاتف، والعناوين
   */
  @Auditable({
    targetEntity: 'User',
    action: AuditActionEnum.UPDATE_PROFILE,
    targetIdExtractor: (req) => req.user?.id || req.user?.sub || req.params?.id,
  })
  @AllowPendingEntity()
  @permissions(Permission.PROFILE_UPDATE)
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user profile info',
    description: 'Updates personal name, phone number, and address entries',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated' })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileDto,
    @User('id') userId?: string,
  ) {
    const id = req.user?.id || req.user?.sub || userId;
    return this.userService.updateProfile(id, dto, req.user);
  }

  /**
   * تغيير كلمة المرور للمستخدم المسجل
   */
  @Auditable({
    targetEntity: 'User',
    action: AuditActionEnum.CHANGE_PASSWORD,
    targetIdExtractor: (req) => req.user?.id || req.user?.sub,
  })
  @AllowPendingEntity()
  @permissions(Permission.PROFILE_UPDATE)
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password & revoke other sessions',
    description: 'Validates old password, applies new password hash, and rotates session tokenVersion',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password changed successfully' })
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
  @Auditable({
    targetEntity: 'User',
    action: AuditActionEnum.UPDATE_PROFILE,
    targetIdExtractor: (req) => req.user?.id || req.user?.sub,
  })
  @AllowPendingEntity()
  @permissions(Permission.PROFILE_UPDATE)
  @Patch('profile-pic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user avatar',
    description: 'Updates profile picture URL',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile picture updated' })
  async updateProfilePic(
    @Request() req: any,
    @Body() dto: UpdateProfilePicDto,
    @User('id') userId?: string,
  ) {
    const id = userId || req.user?.id || req.user?.sub;
    return this.userService.updateProfilePic(id, dto.profilePic);
  }
}
