import { Types } from 'mongoose';
import { NotificationChannelEnum } from '../enums/notification-channel.enum';
import { NotificationTypeEnum } from '../enums/notification-type.enum';

export interface INotification {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  body: string;
  channel: NotificationChannelEnum;
  type: NotificationTypeEnum;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

