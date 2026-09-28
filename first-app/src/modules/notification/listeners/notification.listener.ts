import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification.service';
import { NOTIFICATION_PROVIDER } from '../../../shared/notifications/tokens/notification.tokens';
import { INotification } from '../../../shared/notifications/interfaces/notification.interface';
import {
  OrderCreatedEvent,
  OrderStatusUpdatedEvent,
  EscrowReleasedEvent,
} from '../events/notification.events';
import { NotificationTypeEnum } from '../../../common/enums/notification-type.enum';
import { NotificationChannelEnum } from '../../../common/enums/notification-channel.enum';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: INotification,
  ) {}

  @OnEvent('order.created', { async: true })
  public async handleOrderCreated(event: OrderCreatedEvent) {
    try {
      this.logger.log(
        `Received 'order.created' event for Order #${event.orderNumber}`,
      );

      const title = 'تم إنشاء الطلب بنجاح';
      const message = `تم إنشاء طلبك رقم #${event.orderNumber} بمبلغ $${event.totalAmount}.`;

      // 1. Persist in Database
      await this.notificationService.sendNotification(
        event.customerId,
        title,
        message,
        NotificationTypeEnum.ORDER_PLACED,
        NotificationChannelEnum.IN_APP,
        { orderId: event.orderId, orderNumber: event.orderNumber },
      );

      // 2. Real-time Socket.IO Broadcast using INotification interface
      await this.notificationProvider.send({
        recipientId: event.customerId,
        title,
        message,
        type: NotificationTypeEnum.ORDER_PLACED,
        data: { orderId: event.orderId, orderNumber: event.orderNumber },
      });
    } catch (err) {
      this.logger.error(
        'Error handling order.created notification listener',
        err,
      );
    }
  }

  @OnEvent('order.status_updated', { async: true })
  public async handleOrderStatusUpdated(event: OrderStatusUpdatedEvent) {
    try {
      this.logger.log(
        `Received 'order.status_updated' event for Order #${event.orderId} -> ${event.status}`,
      );

      const title = 'تحديث حالة الطلب';
      const message = `تم تحديث حالة الطلب إلى "${event.status}"${
        event.note ? `: ${event.note}` : ''
      }.`;

      // 1. Persist in Database
      await this.notificationService.sendNotification(
        event.recipientId,
        title,
        message,
        NotificationTypeEnum.ORDER_STATUS_CHANGED,
        NotificationChannelEnum.IN_APP,
        { orderId: event.orderId, status: event.status },
      );

      // 2. Real-time Socket.IO Broadcast using INotification interface
      await this.notificationProvider.send({
        recipientId: event.recipientId,
        title,
        message,
        type: NotificationTypeEnum.ORDER_STATUS_CHANGED,
        data: { orderId: event.orderId, status: event.status },
      });
    } catch (err) {
      this.logger.error(
        'Error handling order.status_updated notification listener',
        err,
      );
    }
  }

  @OnEvent('escrow.released', { async: true })
  public async handleEscrowReleased(event: EscrowReleasedEvent) {
    try {
      this.logger.log(
        `Received 'escrow.released' event for Entity Order #${event.entityOrderId}`,
      );

      const title = 'تحرير رصيد الضمان (Escrow Released)';
      const message = `تم تحرير رصيد المبيعات بمبلغ $${event.amount} وإضافته لرصيدك المتاح للصرف.`;

      // 1. Persist in Database
      if (event.vendorOwnerId) {
        await this.notificationService.sendNotification(
          event.vendorOwnerId,
          title,
          message,
          NotificationTypeEnum.ESCROW_RELEASED,
          NotificationChannelEnum.IN_APP,
          { entityOrderId: event.entityOrderId, amount: event.amount },
        );

        // 2. Real-time Socket.IO Broadcast using INotification interface
        await this.notificationProvider.send({
          recipientId: event.vendorOwnerId,
          title,
          message,
          type: NotificationTypeEnum.ESCROW_RELEASED,
          data: { entityOrderId: event.entityOrderId, amount: event.amount },
        });
      }
    } catch (err) {
      this.logger.error(
        'Error handling escrow.released notification listener',
        err,
      );
    }
  }
}
