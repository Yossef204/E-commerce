import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Connection, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { ReturnRequestRepo } from '../../models/return/return-request.repository';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import { PaymentRepo } from '../../models/payment/payment.repository';
import {
  ReturnStatusEnum,
  InspectionResultEnum,
  RefundMethodEnum,
} from '../../common/enums/return-status.enum';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { RolesEnum } from '../../common/enums/roles';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
} from '../../models/ledger/ledger-entry.schema';
import { LedgerAccountEnum } from '../../common/enums/ledger-account.enum';
import { LedgerEntryTypeEnum } from '../../common/enums/ledger-entry-type.enum';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { InspectReturnRequestDto } from './dto/inspect-return-request.dto';
import { runSafeTransaction } from '../../common/utils/transaction.util';

@Injectable()
export class ReturnService {
  private readonly logger = new Logger(ReturnService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly returnRepo: ReturnRequestRepo,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly entityOrderRepo: EntityOrderRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly ledgerRepo: LedgerRepo,
    private readonly paymentRepo: PaymentRepo,
  ) {}

  /**
   * Customer submits a return request for items in a delivered order
   */
  async requestReturn(customerIdStr: string, dto: CreateReturnRequestDto) {
    if (!Types.ObjectId.isValid(customerIdStr)) {
      throw new BadRequestException('معرف المستخدم غير صالح');
    }
    const customerId = new Types.ObjectId(customerIdStr);

    if (!Types.ObjectId.isValid(dto.orderId) || !Types.ObjectId.isValid(dto.entityOrderId)) {
      throw new BadRequestException('معرفات الطلب غير صالحة');
    }
    const orderId = new Types.ObjectId(dto.orderId);
    const entityOrderId = new Types.ObjectId(dto.entityOrderId);

    const mainOrder = await this.mainOrderRepo.getOne({ _id: orderId });
    if (!mainOrder) {
      throw new NotFoundException('الطلب الرئيسي غير موجود');
    }

    if (mainOrder.customerId.toString() !== customerId.toString()) {
      throw new ForbiddenException('لا يمكنك تقديم طلب إرجاع لطلب لا يخصك');
    }

    const entityOrder = await this.entityOrderRepo.getOne({ _id: entityOrderId });
    if (!entityOrder) {
      throw new NotFoundException('الطلب الفرعي للمتجر غير موجود');
    }

    if (entityOrder.mainOrderId.toString() !== orderId.toString()) {
      throw new BadRequestException('الطلب الفرعي لا ينتمي للطلب الرئيسي المحدد');
    }

    if (entityOrder.status !== EntityOrderStatusEnum.DELIVERED) {
      throw new BadRequestException(
        'لا يمكن تقديم طلب إرجاع إلا بعد استلام وتوصيل الطلب بنجاح (DELIVERED)',
      );
    }

    // Check return window (14 days from delivery)
    const deliveredHistory = entityOrder.statusHistory?.find(
      (h) => h.status === EntityOrderStatusEnum.DELIVERED,
    );
    const deliveredAt = deliveredHistory?.updatedAt || (entityOrder as any).updatedAt || new Date();
    const diffDays = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 14) {
      throw new BadRequestException(
        'انتهت فترة السماح بطلب الإرجاع (14 يوماً من تاريخ استلام الطلب)',
      );
    }

    // Check if there is an active return request for this entityOrder
    const existingActiveReturn = await this.returnRepo.getOne({
      entityOrderId,
      status: { $in: [ReturnStatusEnum.REQUESTED, ReturnStatusEnum.APPROVED, ReturnStatusEnum.ITEM_RECEIVED] },
    });
    if (existingActiveReturn) {
      throw new BadRequestException('يوجد طلب إرجاع قيد المعالجة بالفعل لهذا الطلب');
    }

    // Calculate total refund amount
    let totalRefundAmount = 0;
    const validatedItems = dto.items.map((it) => {
      totalRefundAmount += it.price * it.quantity;
      return {
        productId: new Types.ObjectId(it.productId),
        sku: it.sku,
        quantity: it.quantity,
        price: it.price,
        reason: it.reason,
      };
    });

    const returnRequest = await this.returnRepo.create({
      orderId,
      entityOrderId,
      customerId,
      sellingEntityId: entityOrder.sellingEntityId,
      items: validatedItems,
      status: ReturnStatusEnum.REQUESTED,
      refundAmount: Math.round(totalRefundAmount * 100) / 100,
      refundMethod: dto.refundMethod || RefundMethodEnum.ORIGINAL_PAYMENT,
      proofImages: dto.proofImages || [],
      customerReason: dto.customerReason || 'طلب إرجاع من العميل',
    });

    return {
      success: true,
      message: 'تم إرسال طلب الإرجاع بنجاح، وسيتم مراجعته من قبل إدارة المتجر',
      returnRequest,
    };
  }

  /**
   * Get return requests for a specific vendor/selling entity
   */
  async getVendorReturns(
    sellingEntityId: Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ) {
    const filter: Record<string, any> = { sellingEntityId };
    if (status && status !== 'ALL') {
      filter.status = status;
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [returns, total] = await Promise.all([
      this.returnRepo.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('orderId', 'orderNumber totalAmount status createdAt')
        .populate('customerId', 'name email phone')
        .lean()
        .exec(),
      this.returnRepo.model.countDocuments(filter),
    ]);

    return {
      returns,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Customer retrieves their own return requests
   */
  async getCustomerReturns(customerId: Types.ObjectId) {
    return this.returnRepo.model
      .find({ customerId })
      .sort({ createdAt: -1 })
      .populate('orderId', 'orderNumber totalAmount status createdAt')
      .populate('sellingEntityId', 'tradeName legalName')
      .lean()
      .exec();
  }

  /**
   * Vendor inspects and approves or rejects a return request
   */
  async inspectAndApprove(
    userIdStr: string,
    returnIdStr: string,
    dto: InspectReturnRequestDto,
    currentUser?: any,
  ) {
    if (!Types.ObjectId.isValid(returnIdStr)) {
      throw new BadRequestException('معرف طلب الإرجاع غير صالح');
    }
    const returnId = new Types.ObjectId(returnIdStr);

    const returnDoc = await this.returnRepo.getOne({ _id: returnId });
    if (!returnDoc) {
      throw new NotFoundException('طلب الإرجاع غير موجود');
    }

    // Role and ownership verification
    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === RolesEnum.SUPER_ADMIN.toLowerCase();

    if (!isAdmin && userIdStr && Types.ObjectId.isValid(userIdStr)) {
      const sellingEntity = await this.sellingEntityRepo.getOne({
        _id: returnDoc.sellingEntityId,
      });
      const isOwner =
        sellingEntity &&
        (sellingEntity.primaryOwnerId?.toString() === userIdStr.toString() ||
          (currentUser?.sellingEntityId &&
            sellingEntity._id.toString() === currentUser.sellingEntityId.toString()));

      if (!isOwner) {
        throw new ForbiddenException('غير مصرح لك بإدارة مرتجعات هذا المتجر');
      }
    }

    const updatePayload: Record<string, any> = {
      status: dto.status,
    };

    if (dto.inspectionResult) {
      updatePayload.inspectionResult = dto.inspectionResult;
    }
    if (dto.vendorNote) {
      updatePayload.vendorNote = dto.vendorNote;
    }
    if (dto.rejectionReason) {
      updatePayload.rejectionReason = dto.rejectionReason;
    }

    const updated = await this.returnRepo.updateOne(
      { _id: returnId },
      { $set: updatePayload },
    );

    return {
      success: true,
      message: `تم تحديث حالة طلب الإرجاع إلى: ${dto.status}`,
      returnRequest: updated,
    };
  }

  /**
   * Process refund atomically: Restock if resalable, reverse ledger entries, and finalize
   */
  async processRefund(userIdStr: string, returnIdStr: string, currentUser?: any) {
    if (!Types.ObjectId.isValid(returnIdStr)) {
      throw new BadRequestException('معرف طلب الإرجاع غير صالح');
    }
    const returnId = new Types.ObjectId(returnIdStr);

    const returnDoc = await this.returnRepo.getOne({ _id: returnId });
    if (!returnDoc) {
      throw new NotFoundException('طلب الإرجاع غير موجود');
    }

    if (returnDoc.status === ReturnStatusEnum.REFUNDED) {
      throw new BadRequestException('تم رد قيمة هذا المرتجع مسبقاً');
    }

    if (
      returnDoc.status !== ReturnStatusEnum.ITEM_RECEIVED &&
      returnDoc.status !== ReturnStatusEnum.APPROVED &&
      returnDoc.status !== ReturnStatusEnum.INSPECTED
    ) {
      throw new BadRequestException(
        'يجب فحص واستلام المنتجات (INSPECTED أو ITEM_RECEIVED أو APPROVED) قبل تنفيذ الاسترجاع المالي',
      );
    }

    // Role and ownership verification
    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === RolesEnum.SUPER_ADMIN.toLowerCase();

    if (!isAdmin && userIdStr && Types.ObjectId.isValid(userIdStr)) {
      const sellingEntity = await this.sellingEntityRepo.getOne({
        _id: returnDoc.sellingEntityId,
      });
      const isOwner =
        sellingEntity &&
        (sellingEntity.primaryOwnerId?.toString() === userIdStr.toString() ||
          (currentUser?.sellingEntityId &&
            sellingEntity._id.toString() === currentUser.sellingEntityId.toString()));

      if (!isOwner) {
        throw new ForbiddenException('غير مصرح لك بتنفيذ استرجاع هذا المتجر');
      }
    }

    const sellingEntity = await this.sellingEntityRepo.getOne({
      _id: returnDoc.sellingEntityId,
    });
    const commPct = sellingEntity?.commissionPercentage ?? 10;
    const commissionReversal =
      Math.round(returnDoc.refundAmount * (commPct / 100) * 100) / 100;
    const netSellerDeduction =
      Math.max(0, returnDoc.refundAmount - commissionReversal);

    await runSafeTransaction(this.connection, async (session) => {
      const options = session ? { session } : undefined;

      // 1. Restock items atomically if condition is RESALABLE or DAMAGED_RESTOCKABLE
      if (
        returnDoc.inspectionResult === InspectionResultEnum.RESALABLE ||
        returnDoc.inspectionResult === InspectionResultEnum.DAMAGED_RESTOCKABLE
      ) {
        for (const item of returnDoc.items) {
          await this.inventoryRepo.restockAtomic(
            item.sku,
            item.quantity,
            options,
          );
        }
      }

      // 2. Ledger Reverse Entries:
      // A. REFUND_DEBIT on Seller's withdrawable balance
      await this.ledgerRepo.create(
        {
          sellingEntityId: returnDoc.sellingEntityId,
          orderId: returnDoc.orderId,
          entityOrderId: returnDoc.entityOrderId,
          entryType: LedgerMovementTypeEnum.REFUND_DEBIT,
          account: LedgerAccountEnum.VENDOR_PAYABLE,
          type: LedgerEntryTypeEnum.DEBIT,
          amount: -Math.abs(netSellerDeduction),
          currency: 'EGP',
          status: LedgerEntryStatusEnum.SETTLED,
          reference: `REFUND-${returnDoc._id}`,
          description: `خصم استرجاع مرتجع معتمد #${returnDoc._id} للطلب #${returnDoc.orderId}`,
        },
        options,
      );

      // B. Platform commission reversal (platform refunds its commission back to seller)
      if (commissionReversal > 0) {
        await this.ledgerRepo.create(
          {
            sellingEntityId: returnDoc.sellingEntityId,
            orderId: returnDoc.orderId,
            entityOrderId: returnDoc.entityOrderId,
            entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
            account: LedgerAccountEnum.PLATFORM_COMMISSION,
            type: LedgerEntryTypeEnum.CREDIT,
            amount: commissionReversal,
            currency: 'EGP',
            status: LedgerEntryStatusEnum.SETTLED,
            reference: `REFUND-COMMISSION-${returnDoc._id}`,
            description: `رد عمولة المنصة المستقطعة عن المرتجع #${returnDoc._id}`,
          },
          options,
        );
      }

      // 3. Mark return document as REFUNDED
      await this.returnRepo.model.updateOne(
        { _id: returnDoc._id },
        {
          $set: {
            status: ReturnStatusEnum.REFUNDED,
            refundedAt: new Date(),
          },
        },
        options,
      );
    }, this.logger);

    return {
      success: true,
      message: `تم تنفيذ الاسترجاع المالي بقيمة ${returnDoc.refundAmount} ج.م بنجاح، وتحديث المخزون ودفتر الأستاذ`,
      refundedAmount: returnDoc.refundAmount,
    };
  }
}

