import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from '../../models/notification/notification.schema';
import { NotificationRepo } from '../../models/notification/notification.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [NotificationRepo],
  exports: [NotificationRepo],
})
export class NotificationMongoModule {}
