import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { MainOrder } from '../../../models/order/main-order.schema';
import { EntityOrder, StatusHistoryEntry } from '../../../models/order/entity-order.schema';
import { OrderItem } from '../../../models/order/order-item.schema';
import { MainOrderStatusEnum } from '../../../common/enums/main-order-status.enum';
import { EntityOrderStatusEnum } from '../../../common/enums/entity-order-status.enum';

export interface ResolvedCartItem {
  sellingEntityId: Types.ObjectId;
  variantId: string;
  sku: string;
  titleSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

@Injectable()
export class OrderFactory {
  generateOrderNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${timestamp}-${random}`;
  }

  createMainOrderEntity(
    customerId: Types.ObjectId,
    totalAmount: number,
    idempotencyKey: string,
    shippingAddress: string,
  ): MainOrder {
    const mainOrder = new MainOrder();
    mainOrder._id = new Types.ObjectId();
    mainOrder.customerId = customerId;
    mainOrder.orderNumber = this.generateOrderNumber();
    mainOrder.totalAmount = totalAmount;
    mainOrder.status = MainOrderStatusEnum.PAID;
    mainOrder.status = MainOrderStatusEnum.PENDING_PAYMENT;
    mainOrder.idempotencyKey = idempotencyKey;
    mainOrder.shippingAddress = shippingAddress;
    return mainOrder;
  }

  createEntityOrderEntities(
    mainOrderId: Types.ObjectId,
    resolvedItems: ResolvedCartItem[],
  ): EntityOrder[] {
    const entityMap = new Map<string, ResolvedCartItem[]>();

    for (const item of resolvedItems) {
      const key = item.sellingEntityId.toString();
      if (!entityMap.has(key)) {
        entityMap.set(key, []);
      }
      entityMap.get(key)!.push(item);
    }

    const entityOrders: EntityOrder[] = [];

    for (const [entityIdStr, items] of entityMap.entries()) {
      const entityOrder = new EntityOrder();
      entityOrder._id = new Types.ObjectId();
      entityOrder.mainOrderId = mainOrderId;
      entityOrder.sellingEntityId = new Types.ObjectId(entityIdStr);

      let subtotal = 0;
      entityOrder.items = items.map((i) => {
        const orderItem = new OrderItem();
        orderItem.variantId = i.variantId;
        orderItem.sku = i.sku;
        orderItem.titleSnapshot = i.titleSnapshot;
        orderItem.quantity = i.quantity;
        orderItem.unitPrice = i.unitPrice;
        orderItem.totalPrice = i.totalPrice;
        subtotal += i.totalPrice;
        return orderItem;
      });

      entityOrder.subtotal = subtotal;
      entityOrder.status = EntityOrderStatusEnum.PENDING;

      const initialHistory = new StatusHistoryEntry();
      initialHistory.status = EntityOrderStatusEnum.PENDING;
      initialHistory.updatedAt = new Date();
      initialHistory.note = 'Order split and created';
      entityOrder.statusHistory = [initialHistory];

      entityOrders.push(entityOrder);
    }

    return entityOrders;
  }
}

