import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PaymentRepo } from '../../models/payment/payment.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import { PayoutRepo } from '../../models/payout/payout.repository';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { PaymentFactory } from './factory/payment.factory';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ReleaseEscrowDto } from './dto/release-escrow.dto';
import { ProcessPayoutDto } from './dto/process-payout.dto';
import { PaymentStatusEnum } from '../../common/enums/payment-status.enum';
import { MainOrderStatusEnum } from '../../common/enums/main-order-status.enum';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';
import { PayoutStatusEnum } from '../../common/enums/payout-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentReceivedEvent } from '../../common/events/payment-received.event';
import { AuditLogEvent } from '../../common/events/audit-log.event';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

import { InventoryRepo } from '../../models/inventory/inventory.repository';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepo,
    private readonly escrowRepo: EscrowRepo,
    private readonly payoutRepo: PayoutRepo,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly entityOrderRepo: EntityOrderRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly paymentFactory: PaymentFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  public async processPayment(dto: ProcessPaymentDto, customerId: string) {
    // 1. Idempotency Check
    const existingPayment = await this.paymentRepo.getOne({
      idempotencyKey: dto.idempotencyKey,
    });
    if (existingPayment) {
      return {
        message: 'Payment already processed (Idempotent response)',
        payment: existingPayment,
      };
    }

    // 2. Fetch Main Order
    const mainOrder = await this.mainOrderRepo.getOne({
      _id: new Types.ObjectId(dto.mainOrderId),
      customerId: new Types.ObjectId(customerId),
    });

    if (!mainOrder) {
      throw new NotFoundException(`Main Order #${dto.mainOrderId} not found.`);
    }

    if (mainOrder.status !== MainOrderStatusEnum.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Main Order #${dto.mainOrderId} is in status '${mainOrder.status}' and cannot be paid.`,
      );
    }

    // 3. Fetch Entity Orders
    const entityOrders = await this.entityOrderRepo.getAll({
      mainOrderId: mainOrder._id,
    });

    if (!entityOrders || entityOrders.length === 0) {
      throw new BadRequestException(
        `No entity sub-orders found for Main Order #${dto.mainOrderId}.`,
      );
    }

    // 4. Record Payment (Gateway Simulation)
    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payment = await this.paymentRepo.create({
      mainOrderId: mainOrder._id,
      customerId: new Types.ObjectId(customerId),
      amount: mainOrder.totalAmount,
      currency: 'USD',
      paymentMethod: dto.paymentMethod,
      status: PaymentStatusEnum.CAPTURED,
      transactionId,
      idempotencyKey: dto.idempotencyKey,
    });

    // 5. Update MainOrder Status to PAID
    await this.mainOrderRepo.updateOne(
      { _id: mainOrder._id },
      { status: MainOrderStatusEnum.PAID },
    );

    // 6. Update EntityOrders Status to CONFIRMED, commit stock, and create Escrow Entries
    const createdEscrows: any[] = [];
    for (const entityOrder of entityOrders) {
      await this.entityOrderRepo.updateOne(
        { _id: entityOrder._id },
        {
          status: EntityOrderStatusEnum.CONFIRMED,
          $push: {
            statusHistory: {
              status: EntityOrderStatusEnum.CONFIRMED,
              updatedAt: new Date(),
              note: 'Payment captured successfully',
            },
          },
        },
      );

      // Commit reserved stock atomically
      for (const item of entityOrder.items) {
        await this.inventoryRepo.commitStockAtomic(item.sku, item.quantity);
      }

      const escrowData = this.paymentFactory.buildEscrowEntry(
        mainOrder._id,
        entityOrder._id,
        entityOrder.sellingEntityId,
        entityOrder.subtotal,
      );

      const escrowDoc = await this.escrowRepo.create(escrowData);
      createdEscrows.push(escrowDoc);
    }

    // 7. Emit Non-Blocking Events
    this.eventEmitter.emit(
      'payment.received',
      new PaymentReceivedEvent(
        payment._id.toString(),
        mainOrder._id.toString(),
        customerId,
        payment.amount,
      ),
    );

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(
        customerId,
        AuditActionEnum.STATUS_CHANGE,
        'Payment',
        payment._id.toString(),
        undefined,
        { status: payment.status, amount: payment.amount },
      ),
    );

    return {
      message: 'Payment processed successfully',
      payment,
      escrowEntriesCreated: createdEscrows.length,
    };
  }

  public async releaseEscrow(dto: ReleaseEscrowDto) {
    const escrow = await this.escrowRepo.getOne({
      entityOrderId: new Types.ObjectId(dto.entityOrderId),
    });

    if (!escrow) {
      throw new NotFoundException(
        `Escrow entry for Entity Order #${dto.entityOrderId} not found.`,
      );
    }

    if (escrow.status === EscrowStatusEnum.RELEASED) {
      return {
        message: 'Escrow already released',
        escrow,
      };
    }

    if (escrow.status !== EscrowStatusEnum.HELD) {
      throw new BadRequestException(
        `Escrow status is '${escrow.status}' and cannot be released.`,
      );
    }

    const updatedEscrow = await this.escrowRepo.updateOne(
      { _id: escrow._id },
      {
        status: EscrowStatusEnum.RELEASED,
        releasedAt: new Date(),
      },
    );

    return {
      message: 'Escrow funds released to vendor net balance successfully',
      escrow: updatedEscrow,
    };
  }

  public async releaseEscrowOnDelivery(entityOrderId: string) {
    const escrow = await this.escrowRepo.getOne({
      entityOrderId: new Types.ObjectId(entityOrderId),
    });

    if (escrow && escrow.status === EscrowStatusEnum.HELD) {
      await this.escrowRepo.updateOne(
        { _id: escrow._id },
        {
          status: EscrowStatusEnum.RELEASED,
          releasedAt: new Date(),
        },
      );
    }
  }

  public async processVendorPayout(dto: ProcessPayoutDto) {
    const sellingEntityId = new Types.ObjectId(dto.sellingEntityId);

    const releasedEscrows = await this.escrowRepo.getAll({
      sellingEntityId,
      status: EscrowStatusEnum.RELEASED,
    });

    if (!releasedEscrows || releasedEscrows.length === 0) {
      throw new BadRequestException(
        `No released escrow funds available for payout to selling entity #${dto.sellingEntityId}.`,
      );
    }

    const totalPayoutAmount = releasedEscrows.reduce(
      (sum, e) => sum + e.netAmount,
      0,
    );
    const escrowIds = releasedEscrows.map((e) => e._id!);

    const payoutData = this.paymentFactory.buildPayoutBatch(
      sellingEntityId,
      escrowIds,
      totalPayoutAmount,
    );

    const payout = await this.payoutRepo.create(payoutData);

    // Update payout status to PAID (simulated transfer)
    await this.payoutRepo.updateOne(
      { _id: payout._id },
      {
        status: PayoutStatusEnum.PAID,
        processedAt: new Date(),
      },
    );

    return {
      message: 'Vendor payout batch processed successfully',
      payout,
      escrowItemsCompiled: escrowIds.length,
    };
  }

  public async getSellerFinancialSummary(sellingEntityId: string) {
    const escrows = await this.escrowRepo.getAll({
      sellingEntityId: new Types.ObjectId(sellingEntityId),
    });

    const payouts = await this.payoutRepo.getAll({
      sellingEntityId: new Types.ObjectId(sellingEntityId),
    });

    let totalGrossSales = 0;
    let totalPlatformFees = 0;
    let heldBalance = 0;
    let releasedBalance = 0;

    for (const e of escrows) {
      totalGrossSales += e.grossAmount;
      totalPlatformFees += e.platformFee;

      if (e.status === EscrowStatusEnum.HELD) {
        heldBalance += e.netAmount;
      } else if (e.status === EscrowStatusEnum.RELEASED) {
        releasedBalance += e.netAmount;
      }
    }

    return {
      sellingEntityId,
      summary: {
        totalGrossSales: Math.round(totalGrossSales * 100) / 100,
        totalPlatformFees: Math.round(totalPlatformFees * 100) / 100,
        heldEscrowBalance: Math.round(heldBalance * 100) / 100,
        availablePayoutBalance: Math.round(releasedBalance * 100) / 100,
        totalEscrowRecords: escrows.length,
        totalPayoutBatches: payouts.length,
      },
      payoutHistory: payouts,
    };
  }
}

