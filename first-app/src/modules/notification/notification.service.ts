import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { NotificationRepo } from '../../models/notification/notification.repository';
import { NotificationChannelEnum } from '../../common/enums/notification-channel.enum';
import { NotificationTypeEnum } from '../../common/enums/notification-type.enum';
import { OrderPlacedEvent } from '../../common/events/order-placed.event';
import { PaymentReceivedEvent } from '../../common/events/payment-received.event';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly notificationRepo: NotificationRepo) {}

  public async sendNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationTypeEnum,
    channel: NotificationChannelEnum = NotificationChannelEnum.IN_APP,
    metadata?: Record<string, any>,
  ) {
    this.logger.log(
      `[${channel}] Sending notification '${title}' to user ${userId}`,
    );

    // Simulated email / push log
    if (channel === NotificationChannelEnum.EMAIL) {
      this.logger.log(`Simulating EMAIL dispatch to user #${userId}: ${title}`);
    } else if (channel === NotificationChannelEnum.PUSH) {
      this.logger.log(
        `Simulating FCM PUSH dispatch to user #${userId}: ${title}`,
      );
    }

    // Always record In-App notification copy for user inbox
    return this.notificationRepo.create({
      userId: new Types.ObjectId(userId),
      title,
      body,
      channel,
      type,
      isRead: false,
      metadata,
    });
  }

  @OnEvent('order.placed', { async: true })
  public async handleOrderPlaced(event: OrderPlacedEvent) {
    try {
      // Notify customer
      await this.sendNotification(
        event.customerId,
        'Order Placed Successfully',
        `Your order #${event.orderNumber} for $${event.totalAmount} has been placed.`,
        NotificationTypeEnum.ORDER_PLACED,
        NotificationChannelEnum.IN_APP,
        { mainOrderId: event.mainOrderId, orderNumber: event.orderNumber },
      );

      // Notify sellers
      for (const sellerEntityId of event.sellerEntityIds) {
        this.logger.log(
          `Notifying SellingEntity #${sellerEntityId} of new order items in #${event.orderNumber}`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Error in handleOrderPlaced notification listener',
        err,
      );
    }
  }

  @OnEvent('payment.received', { async: true })
  public async handlePaymentReceived(event: PaymentReceivedEvent) {
    try {
      await this.sendNotification(
        event.customerId,
        'Payment Confirmed',
        `Payment of $${event.amount} received for order #${event.mainOrderId}.`,
        NotificationTypeEnum.PAYMENT_RECEIVED,
        NotificationChannelEnum.IN_APP,
        { paymentId: event.paymentId, mainOrderId: event.mainOrderId },
      );
    } catch (err) {
      this.logger.error(
        'Error in handlePaymentReceived notification listener',
        err,
      );
    }
  }

  public async getUserNotifications(userId: string) {
    return this.notificationRepo.getAll(
      { userId: new Types.ObjectId(userId) },
      undefined,
      { sort: { createdAt: -1 } },
    );
  }

  public async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepo.getOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundException(`Notification #${notificationId} not found.`);
    }

    return this.notificationRepo.updateOne(
      { _id: notification._id },
      { isRead: true },
    );
  }
}
