import { Module } from '@nestjs/common';
import { NotificationMongoModule } from '../../shared/modules/notification.mongo.module';
import { SharedNotificationModule } from '../../shared/notifications/shared-notification.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationListener } from './listeners/notification.listener';

@Module({
  imports: [NotificationMongoModule, SharedNotificationModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationListener],
  exports: [NotificationService],
})
export class NotificationModule {}
