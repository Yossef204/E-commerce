import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { EscrowStatusEnum } from '../../../common/enums/escrow-status.enum';
import { IEscrowLedger, IVendorPayout } from '../../../common/interfaces/payment.interface';
import { PayoutStatusEnum } from '../../../common/enums/payout-status.enum';

@Injectable()
export class PaymentFactory {
  private readonly DEFAULT_COMMISSION_RATE = 0.10; // 10% platform commission

  public buildEscrowEntry(
    mainOrderId: Types.ObjectId | string,
    entityOrderId: Types.ObjectId | string,
    sellingEntityId: Types.ObjectId | string,
    grossAmount: number,
    commissionRate: number = this.DEFAULT_COMMISSION_RATE,
  ): Partial<IEscrowLedger> {
    const platformFee = Math.round(grossAmount * commissionRate * 100) / 100;
    const netAmount = Math.round((grossAmount - platformFee) * 100) / 100;

    return {
      mainOrderId: new Types.ObjectId(mainOrderId),
      entityOrderId: new Types.ObjectId(entityOrderId),
      sellingEntityId: new Types.ObjectId(sellingEntityId),
      grossAmount,
      commissionRate,
      platformFee,
      netAmount,
      status: EscrowStatusEnum.HELD,
    };
  }

  public generatePayoutReference(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    return `PAYOUT-${dateStr}-${randomSuffix}`;
  }

  public buildPayoutBatch(
    sellingEntityId: Types.ObjectId | string,
    escrowIds: (Types.ObjectId | string)[],
    totalAmount: number,
  ): Partial<IVendorPayout> {
    return {
      sellingEntityId: new Types.ObjectId(sellingEntityId),
      escrowIds: escrowIds.map((id) => new Types.ObjectId(id)),
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: PayoutStatusEnum.PENDING,
      payoutReference: this.generatePayoutReference(),
    };
  }
}

