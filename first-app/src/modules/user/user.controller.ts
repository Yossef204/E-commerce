import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfilePicDto } from './dto/update-profile-pic.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { User } from '../../common/decorators/user.decorators';

@UseGuards(AuthenticationGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // راوت تحديث صورة الملف الشخصي
  @Patch('profile-pic')
  @HttpCode(HttpStatus.OK)
  updateProfilePic(
    @User('id') userId: string,
    @Body() dto: UpdateProfilePicDto,
  ) {
    return this.userService.updateProfilePic(userId, dto.profilePic);
  }
}
