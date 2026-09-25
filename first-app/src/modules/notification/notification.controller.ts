import { Controller, Get, Patch, Param, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('my-notifications')
  public async getMyNotifications(@Request() req: any) {
    const userId = req.user?.id || req.query.userId;
    return this.notificationService.getUserNotifications(userId);
  }

  @Patch(':id/read')
  public async markAsRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id || req.body.userId;
    return this.notificationService.markAsRead(id, userId);
  }
}

