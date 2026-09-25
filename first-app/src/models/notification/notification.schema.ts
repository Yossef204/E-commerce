import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NotificationChannelEnum } from '../../common/enums/notification-channel.enum';
import { NotificationTypeEnum } from '../../common/enums/notification-type.enum';
import { INotification } from '../../common/interfaces/notification.interface';

export type TNotification = INotification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String })
  title: string;

  @Prop({ required: true, type: String })
  body: string;

  @Prop({ required: true, enum: NotificationChannelEnum, default: NotificationChannelEnum.IN_APP, type: String })
  channel: NotificationChannelEnum;

  @Prop({ required: true, enum: NotificationTypeEnum, type: String })
  type: NotificationTypeEnum;

  @Prop({ required: true, type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

