import { Controller, Get, Patch, Param, Request, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @permissions(Permission.PROFILE_READ)
  @Get('my-notifications')
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User notifications retrieved' })
  public async getMyNotifications(@Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationService.getUserNotifications(userId);
  }

  @permissions(Permission.PROFILE_UPDATE)
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notification marked as read' })
  public async markAsRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationService.markAsRead(id, userId);
  }
}
