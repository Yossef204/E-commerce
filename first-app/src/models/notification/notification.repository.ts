import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Notification, TNotification } from './notification.schema';

@Injectable()
export class NotificationRepo extends AbstractRepo<TNotification> {
  constructor(
    @InjectModel(Notification.name) notificationModel: Model<TNotification>,
  ) {
    super(notificationModel);
  }
}

