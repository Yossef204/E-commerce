import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import { OrderFactory, ResolvedCartItem } from './factory/order.factory';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateEntityOrderStatusDto } from './dto/update-entity-order-status.dto';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { MainOrderStatusEnum } from '../../common/enums/main-order-status.enum';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';
import { LedgerAccountEnum } from '../../common/enums/ledger-account.enum';
import { LedgerEntryTypeEnum } from '../../common/enums/ledger-entry-type.enum';
import { CouponScopeEnum } from '../../common/enums/coupon-scope.enum';
import { CouponService } from '../coupon/coupon.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderPlacedEvent } from '../../common/events/order-placed.event';
import { AuditLogEvent } from '../../common/events/audit-log.event';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';
import {
  OrderCreatedEvent,
  OrderStatusUpdatedEvent,
} from '../notification/events/notification.events';

@Injectable()
export class OrderService {
  constructor(
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly entityOrderRepo: EntityOrderRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly productRepo: ProductRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly escrowRepo: EscrowRepo,
    private readonly ledgerRepo: LedgerRepo,
    private readonly orderFactory: OrderFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly couponService: CouponService,
  ) {}

  async checkout(customerIdStr: string, checkoutDto: CheckoutDto) {
    if (!customerIdStr || !Types.ObjectId.isValid(customerIdStr)) {
      throw new BadRequestException('Invalid customer ID format');
    }
    const customerId = new Types.ObjectId(customerIdStr);

    const existingOrder = await this.mainOrderRepo.getOne({
      idempotencyKey: checkoutDto.idempotencyKey,
    });
    if (existingOrder) {
      const entityOrders = await this.entityOrderRepo.getAll({
        mainOrderId: existingOrder._id,
      });
      return {
        message: 'Order already processed (Idempotency matched)',
        mainOrder: existingOrder,
        entityOrders,
      };
    }

    if (!checkoutDto.items || checkoutDto.items.length === 0) {
      throw new BadRequestException('Checkout items cannot be empty');
    }

    const resolvedItems: ResolvedCartItem[] = [];
    for (const itemDto of checkoutDto.items) {
      const inventory = await this.inventoryRepo.getOne({
        sku: itemDto.sku.trim(),
      });
      if (!inventory) {
        throw new NotFoundException(
          `Inventory record for SKU "${itemDto.sku}" not found`,
        );
      }

      const product = await this.productRepo.getOne({
        _id: inventory.productId,
      });
      if (
        !product ||
        product.approvalStatus !== ProductApprovalStatusEnum.APPROVED
      ) {
        throw new BadRequestException(
          `Product for SKU "${itemDto.sku}" is not available or approved for purchase`,
        );
      }

      const variant = product.variants.find(
        (v) => v.sku === itemDto.sku.trim(),
      );
      if (!variant || !variant.isActive) {
        throw new BadRequestException(
          `Variant for SKU "${itemDto.sku}" is inactive`,
        );
      }

      const unitPrice = variant.price;
      const totalPrice = unitPrice * itemDto.quantity;

      resolvedItems.push({
        sellingEntityId: product.sellingEntityId,
        variantId: variant._id ? variant._id.toString() : variant.sku,
        sku: variant.sku,
        titleSnapshot: `${product.title} - (${variant.sku})`,
        quantity: itemDto.quantity,
        unitPrice,
        totalPrice,
      });
    }

    // Atomic Stock Reservation check
    const reservedSkus: { sku: string; quantity: number }[] = [];
    for (const item of resolvedItems) {
      const reserved = await this.inventoryRepo.reserveStockAtomic(
        item.sku,
        item.quantity,
      );

      if (!reserved) {
        for (const r of reservedSkus) {
          await this.inventoryRepo.releaseStockAtomic(r.sku, r.quantity);
        }
        throw new BadRequestException(
          `Insufficient available stock for SKU "${item.sku}". Reservation rolled back.`,
        );
      }

      reservedSkus.push({ sku: item.sku, quantity: item.quantity });
    }

    const originalTotalAmount = resolvedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    // Validate and Apply Coupon if provided
    let appliedCoupon: any = null;
    let totalDiscountAmount = 0;
    let appliedCouponScope: CouponScopeEnum | null = null;
    let targetSellingEntityId: string | null = null;

    if (checkoutDto.couponCode && checkoutDto.couponCode.trim()) {
      const couponResult = await this.couponService.validateAndApplyCoupon(
        checkoutDto.couponCode.trim(),
        customerIdStr,
        checkoutDto.items,
      );
      appliedCoupon = couponResult.coupon;
      totalDiscountAmount = couponResult.discountAmount;
      appliedCouponScope = couponResult.scope;
      targetSellingEntityId = couponResult.sellingEntityId;
    }

    const finalTotalAmount = Math.max(0, originalTotalAmount - totalDiscountAmount);

    const mainOrderData = this.orderFactory.createMainOrderEntity(
      customerId,
      finalTotalAmount,
      checkoutDto.idempotencyKey,
      checkoutDto.shippingAddress,
      totalDiscountAmount,
      appliedCoupon ? appliedCoupon._id : null,
      appliedCoupon ? appliedCoupon.code : null,
    );
    const createdMainOrder = await this.mainOrderRepo.create(mainOrderData);

    const entityOrdersData = this.orderFactory.createEntityOrderEntities(
      createdMainOrder._id,
      resolvedItems,
    );

    const createdEntityOrders: any[] = [];
    for (const eoData of entityOrdersData) {
      if (
        appliedCouponScope === CouponScopeEnum.VENDOR &&
        targetSellingEntityId &&
        eoData.sellingEntityId.toString() === targetSellingEntityId
      ) {
        eoData.discountAmount = totalDiscountAmount;
        eoData.couponId = appliedCoupon._id;
        eoData.couponCode = appliedCoupon.code;
      } else if (appliedCouponScope === CouponScopeEnum.PLATFORM) {
        eoData.couponId = appliedCoupon._id;
        eoData.couponCode = appliedCoupon.code;
      }

      const eo = await this.entityOrderRepo.create(eoData);
      createdEntityOrders.push(eo);

      const sellingEntity = await this.sellingEntityRepo.getOne({
        _id: eo.sellingEntityId,
      });

      const commPct = sellingEntity?.commissionPercentage ?? 10;
      const commFixed = sellingEntity?.commissionFixedFee ?? 0;
      const subtotal = eo.subtotal || (eo as any).totalAmount || 0;

      // Vendor absorbs the discount: subtotal reduced before commission
      let effectiveSubtotal = subtotal;
      if (
        appliedCouponScope === CouponScopeEnum.VENDOR &&
        eo.discountAmount &&
        eo.discountAmount > 0
      ) {
        effectiveSubtotal = Math.max(0, subtotal - eo.discountAmount);
      }

      const commissionAmount = (effectiveSubtotal * (commPct / 100)) + commFixed;
      const netAmount = Math.max(0, effectiveSubtotal - commissionAmount);

      await this.escrowRepo.create({
        mainOrderId: createdMainOrder._id,
        entityOrderId: eo._id,
        sellingEntityId: eo.sellingEntityId,
        grossAmount: effectiveSubtotal,
        subtotal: effectiveSubtotal,
        commissionPercentage: commPct,
        commissionFixedFee: commFixed,
        platformFee: commissionAmount,
        commissionAmount,
        netAmount,
        status: EscrowStatusEnum.HELD,
      });

      await this.ledgerRepo.create({
        sellingEntityId: eo.sellingEntityId,
        entityOrderId: eo._id,
        account: LedgerAccountEnum.ESCROW_HOLDING,
        type: LedgerEntryTypeEnum.CREDIT,
        amount: netAmount,
        reference: `ORDER-${eo._id}`,
        description: `Escrow funds held for EntityOrder ${eo._id}`,
      });

      await this.ledgerRepo.create({
        sellingEntityId: eo.sellingEntityId,
        entityOrderId: eo._id,
        account: LedgerAccountEnum.PLATFORM_COMMISSION,
        type: LedgerEntryTypeEnum.CREDIT,
        amount: commissionAmount,
        reference: `COMMISSION-${eo._id}`,
        description: `Platform commission for EntityOrder ${eo._id}`,
      });

      if (
        appliedCouponScope === CouponScopeEnum.PLATFORM &&
        totalDiscountAmount > 0
      ) {
        await this.ledgerRepo.create({
          sellingEntityId: eo.sellingEntityId,
          entityOrderId: eo._id,
          account: LedgerAccountEnum.PLATFORM_PROMOTION,
          type: LedgerEntryTypeEnum.DEBIT,
          amount: totalDiscountAmount,
          reference: `PROMO-${appliedCoupon.code}`,
          description: `Platform absorbed promotional discount for coupon ${appliedCoupon.code}`,
        });
      }
    }

    // Atomic Coupon Usage Record
    if (appliedCoupon && totalDiscountAmount > 0) {
      await this.couponService.recordCouponUsage(
        appliedCoupon._id,
        customerId,
        createdMainOrder._id,
        totalDiscountAmount,
      );
    }

    for (const item of resolvedItems) {
      await this.inventoryRepo.commitStockAtomic(item.sku, item.quantity);
    }

    const sellerEntityIds = createdEntityOrders.map((eo) =>
      eo.sellingEntityId.toString(),
    );
    this.eventEmitter.emit(
      'order.placed',
      new OrderPlacedEvent(
        createdMainOrder._id.toString(),
        createdMainOrder.orderNumber,
        customerIdStr,
        createdMainOrder.totalAmount,
        sellerEntityIds,
      ),
    );

    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent(
        createdMainOrder._id.toString(),
        customerIdStr,
        createdMainOrder.orderNumber,
        createdMainOrder.totalAmount,
        sellerEntityIds,
      ),
    );

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(
        customerIdStr,
        AuditActionEnum.STATUS_CHANGE,
        'MainOrder',
        createdMainOrder._id.toString(),
        undefined,
        {
          status: createdMainOrder.status,
          totalAmount: createdMainOrder.totalAmount,
          discountAmount: createdMainOrder.discountAmount,
          couponCode: createdMainOrder.couponCode,
        },
      ),
    );

    return {
      message: 'Order created and split successfully across vendors',
      mainOrder: createdMainOrder,
      entityOrders: createdEntityOrders,
    };
  }

  async updateEntityOrderStatus(
    ownerIdStr: string,
    entityOrderIdStr: string,
    updateDto: UpdateEntityOrderStatusDto,
  ) {
    if (!Types.ObjectId.isValid(entityOrderIdStr)) {
      throw new BadRequestException('Invalid entity order ID format');
    }
    const entityOrderId = new Types.ObjectId(entityOrderIdStr);

    const entityOrder = await this.entityOrderRepo.getOne({
      _id: entityOrderId,
    });
    if (!entityOrder) {
      throw new NotFoundException('Entity order not found');
    }

    const sellingEntity = await this.sellingEntityRepo.getOne({
      _id: entityOrder.sellingEntityId,
    });
    if (
      !sellingEntity ||
      sellingEntity.primaryOwnerId.toString() !== ownerIdStr
    ) {
      throw new ForbiddenException(
        'Access denied: You do not own this selling entity',
      );
    }

    const newHistoryEntry = {
      status: updateDto.status,
      updatedAt: new Date(),
      note: updateDto.note || `Status updated to ${updateDto.status}`,
    };

    const updatedHistory = [
      ...(entityOrder.statusHistory || []),
      newHistoryEntry,
    ];

    const updatedEntityOrder = await this.entityOrderRepo.updateOne(
      { _id: entityOrderId },
      {
        status: updateDto.status,
        statusHistory: updatedHistory,
      },
    );

    if (updateDto.status === EntityOrderStatusEnum.DELIVERED) {
      const escrow = await this.escrowRepo.getOne({
        entityOrderId: entityOrder._id,
      });

      if (escrow && escrow.status === EscrowStatusEnum.HELD) {
        await this.escrowRepo.updateOne(
          { _id: escrow._id },
          {
            status: EscrowStatusEnum.RELEASED,
            releasedAt: new Date(),
          },
        );

        await this.ledgerRepo.create({
          sellingEntityId: entityOrder.sellingEntityId,
          entityOrderId: entityOrder._id,
          account: LedgerAccountEnum.ESCROW_HOLDING,
          type: LedgerEntryTypeEnum.DEBIT,
          amount: escrow.netAmount,
          reference: `DELIVERY-RELEASE-${entityOrder._id}`,
          description: `Escrow release on order delivery`,
        });

        await this.ledgerRepo.create({
          sellingEntityId: entityOrder.sellingEntityId,
          entityOrderId: entityOrder._id,
          account: LedgerAccountEnum.VENDOR_PAYABLE,
          type: LedgerEntryTypeEnum.CREDIT,
          amount: escrow.netAmount,
          reference: `DELIVERY-RELEASE-${entityOrder._id}`,
          description: `Vendor payable credit on order delivery`,
        });
      }
    }

    const allEntityOrders = await this.entityOrderRepo.getAll({
      mainOrderId: entityOrder.mainOrderId,
    });

    const allDelivered = allEntityOrders.every(
      (eo) => eo.status === EntityOrderStatusEnum.DELIVERED,
    );
    const anyShippedOrDelivered = allEntityOrders.some(
      (eo) =>
        eo.status === EntityOrderStatusEnum.SHIPPED ||
        eo.status === EntityOrderStatusEnum.DELIVERED,
    );

    if (allDelivered) {
      await this.mainOrderRepo.updateOne(
        { _id: entityOrder.mainOrderId },
        { status: MainOrderStatusEnum.COMPLETED },
      );
    } else if (anyShippedOrDelivered) {
      await this.mainOrderRepo.updateOne(
        { _id: entityOrder.mainOrderId },
        { status: MainOrderStatusEnum.PARTIALLY_FULFILLED },
      );
    }

    const mainOrder = await this.mainOrderRepo.getOne({
      _id: entityOrder.mainOrderId,
    });
    if (mainOrder) {
      this.eventEmitter.emit(
        'order.status_updated',
        new OrderStatusUpdatedEvent(
          entityOrderIdStr,
          mainOrder.customerId.toString(),
          updateDto.status,
          updateDto.note,
        ),
      );
    }

    return {
      message: `Entity order status updated to ${updateDto.status}`,
      entityOrder: updatedEntityOrder,
    };
  }

  async getCustomerOrders(customerIdStr: string) {
    if (!Types.ObjectId.isValid(customerIdStr)) {
      throw new BadRequestException('Invalid customer ID format');
    }
    const customerId = new Types.ObjectId(customerIdStr);

    const mainOrders = await this.mainOrderRepo.getAll({ customerId });
    const ordersWithDetails = [];

    for (const mainOrder of mainOrders) {
      const entityOrders = await this.entityOrderRepo.getAll({
        mainOrderId: mainOrder._id,
      });
      ordersWithDetails.push({
        ...(mainOrder.toObject ? mainOrder.toObject() : mainOrder),
        entityOrders,
      });
    }

    return {
      success: true,
      data: ordersWithDetails,
    };
  }

  async getEntityOrders(ownerIdStr: string, sellingEntityIdStr: string) {
    if (!Types.ObjectId.isValid(sellingEntityIdStr)) {
      throw new BadRequestException('Invalid selling entity ID format');
    }
    const sellingEntityId = new Types.ObjectId(sellingEntityIdStr);

    if (ownerIdStr && Types.ObjectId.isValid(ownerIdStr)) {
      const sellingEntity = await this.sellingEntityRepo.getOne({
        _id: sellingEntityId,
      });
      if (
        sellingEntity &&
        sellingEntity.primaryOwnerId.toString() !== ownerIdStr
      ) {
        throw new ForbiddenException(
          'Access denied: You do not own this selling entity',
        );
      }
    }

    const entityOrders = await this.entityOrderRepo.getAll({ sellingEntityId });
    return {
      success: true,
      data: entityOrders,
    };
  }
}
