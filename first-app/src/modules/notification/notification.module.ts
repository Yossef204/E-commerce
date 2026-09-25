import { Module } from '@nestjs/common';
import { NotificationMongoModule } from '../../shared/modules/notification.mongo.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [NotificationMongoModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

