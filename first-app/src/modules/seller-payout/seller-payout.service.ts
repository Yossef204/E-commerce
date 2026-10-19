import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Connection, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { SellerPayoutMethodRepo } from '../../models/payout/seller-payout-method.repository';
import { PayoutRequestRepo } from '../../models/payout/payout-request.repository';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import {
  PayoutMethodTypeEnum,
  SellerPayoutMethod,
} from '../../models/payout/seller-payout-method.schema';
import {
  PayoutRequestStatusEnum,
  PayoutRequest,
} from '../../models/payout/payout-request.schema';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
  LedgerEntry,
} from '../../models/ledger/ledger-entry.schema';
import { LedgerAccountEnum } from '../../common/enums/ledger-account.enum';
import { LedgerEntryTypeEnum } from '../../common/enums/ledger-entry-type.enum';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { CreatePayoutMethodDto } from './dto/create-payout-method.dto';
import { RequestSellerPayoutDto } from './dto/request-seller-payout.dto';
import { runSafeTransaction } from '../../common/utils/transaction.util';

@Injectable()
export class SellerPayoutService {
  private readonly logger = new Logger(SellerPayoutService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly payoutMethodRepo: SellerPayoutMethodRepo,
    private readonly payoutRequestRepo: PayoutRequestRepo,
    private readonly ledgerRepo: LedgerRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly escrowRepo: EscrowRepo,
    private readonly mainOrderRepo: MainOrderRepo,
  ) {}

  /**
   * Resolve sellingEntityId from explicit string or from user ownerId
   */
  async resolveSellingEntityId(
    sellingEntityIdOrOwnerId?: string,
    ownerId?: string,
  ): Promise<Types.ObjectId> {
    if (
      sellingEntityIdOrOwnerId &&
      Types.ObjectId.isValid(sellingEntityIdOrOwnerId)
    ) {
      const entity = await this.sellingEntityRepo.getOne({
        _id: new Types.ObjectId(sellingEntityIdOrOwnerId),
      });
      if (entity) {
        return entity._id;
      }
    }

    const searchOwner = ownerId || sellingEntityIdOrOwnerId;
    if (searchOwner && Types.ObjectId.isValid(searchOwner)) {
      const entity = await this.sellingEntityRepo.getOne({
        primaryOwnerId: new Types.ObjectId(searchOwner),
      });
      if (entity) {
        return entity._id;
      }
    }

    throw new NotFoundException(
      'لم يتم العثور على المتجر أو الكيان التجاري التابع لهذا المستخدم',
    );
  }

  /**
   * Add a new payout method for seller
   */
  async addPayoutMethod(
    entityId: Types.ObjectId,
    dto: CreatePayoutMethodDto,
  ): Promise<SellerPayoutMethod> {
    const { type, details } = dto;

    if (!details || typeof details !== 'object') {
      throw new BadRequestException('بيانات وسيلة السحب غير صالحة');
    }

    if (type === PayoutMethodTypeEnum.BANK_ACCOUNT) {
      if (!details.accountHolderName || !details.bankName || !details.iban) {
        throw new BadRequestException(
          'يجب ملء اسم صاحب الحساب، اسم البنك، ورقم الآيبان (IBAN) للحساب البنكي',
        );
      }
    } else if (type === PayoutMethodTypeEnum.VODAFONE_CASH) {
      const walletNumber = (details.walletNumber || '').trim();
      const egyptianWalletRegex = /^01[0125][0-9]{8}$/;
      if (!egyptianWalletRegex.test(walletNumber)) {
        throw new BadRequestException(
          'رقم المحفظة الإلكترونية غير صالح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015',
        );
      }
      details.walletNumber = walletNumber;
    } else if (type === PayoutMethodTypeEnum.INSTAPAY) {
      const ipa = (details.instaPayAddress || '').trim();
      if (!ipa || ipa.length < 3) {
        throw new BadRequestException(
          'عنوان إنستاباي (InstaPay IPA / Phone) غير صالح',
        );
      }
      details.instaPayAddress = ipa;
    }

    const existingCount = await this.payoutMethodRepo.model.countDocuments({
      sellingEntityId: entityId,
    });

    const isFirstMethod = existingCount === 0;
    const shouldBeDefault = dto.isDefault ?? isFirstMethod;

    if (shouldBeDefault && !isFirstMethod) {
      await this.payoutMethodRepo.model.updateMany(
        { sellingEntityId: entityId },
        { $set: { isDefault: false } },
      );
    }

    const created = await this.payoutMethodRepo.create({
      sellingEntityId: entityId,
      type,
      details,
      isDefault: shouldBeDefault,
      isVerified: true,
    });

    return created;
  }

  /**
   * List all payout methods for a selling entity
   */
  async getPayoutMethods(
    entityId: Types.ObjectId,
  ): Promise<SellerPayoutMethod[]> {
    return this.payoutMethodRepo.model
      .find({ sellingEntityId: entityId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Set a payout method as default
   */
  async setDefaultPayoutMethod(
    entityId: Types.ObjectId,
    methodIdStr: string,
  ): Promise<SellerPayoutMethod> {
    if (!Types.ObjectId.isValid(methodIdStr)) {
      throw new BadRequestException('معرف وسيلة السحب غير صالح');
    }
    const methodId = new Types.ObjectId(methodIdStr);

    const target = await this.payoutMethodRepo.getOne({
      _id: methodId,
      sellingEntityId: entityId,
    });
    if (!target) {
      throw new NotFoundException('وسيلة السحب غير موجودة');
    }

    await this.payoutMethodRepo.model.updateMany(
      { sellingEntityId: entityId },
      { $set: { isDefault: false } },
    );

    await this.payoutMethodRepo.model.updateOne(
      { _id: methodId },
      { $set: { isDefault: true } },
    );

    return (await this.payoutMethodRepo.getOne({ _id: methodId }))!;
  }

  /**
   * Calculate wallet balances (Pending Escrow, Available for Payout, Total Withdrawn)
   */
  async getWalletBalance(entityId: Types.ObjectId): Promise<{
    pendingBalance: number;
    availableBalance: number;
    withdrawnBalance: number;
    platformDues: number;
    currency: string;
  }> {
    const totalLedgerCount = await this.ledgerRepo.model.countDocuments({
      sellingEntityId: entityId,
    });

    // 1. Pending Escrow Balance (strict: only online payment credit entries currently HELD_ESCROW)
    const heldEscrowEntries = await this.ledgerRepo.getAll({
      sellingEntityId: entityId,
      status: LedgerEntryStatusEnum.HELD_ESCROW,
      entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
    });

    let pendingBalance = 0;
    for (const entry of heldEscrowEntries) {
      if (entry.type === LedgerEntryTypeEnum.CREDIT) {
        pendingBalance += Math.abs(entry.amount);
      }
    }

    // Fallback: Check Escrow collection ONLY if no ledger entries at all exist for this entity
    if (totalLedgerCount === 0 && heldEscrowEntries.length === 0) {
      const escrows = await this.escrowRepo.getAll({
        sellingEntityId: entityId,
        status: EscrowStatusEnum.HELD,
      });
      pendingBalance = escrows.reduce((sum, e) => sum + (e.netAmount || 0), 0);
    }
    pendingBalance = Math.max(0, Math.round(pendingBalance * 100) / 100);

    // 2. Gross Available Credit: only delivered online sales with status AVAILABLE
    const availableEntries = await this.ledgerRepo.getAll({
      sellingEntityId: entityId,
      status: LedgerEntryStatusEnum.AVAILABLE,
      entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
    });

    let grossAvailableCredit = 0;
    for (const entry of availableEntries) {
      if (entry.type === LedgerEntryTypeEnum.CREDIT) {
        grossAvailableCredit += Math.abs(entry.amount);
      }
    }

    // 3. Platform Fee Debits from COD orders (cash collected directly by seller from customer)
    const codCommissionEntries = await this.ledgerRepo.getAll({
      sellingEntityId: entityId,
      entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
      status: LedgerEntryStatusEnum.SETTLED,
      $or: [
        { paymentMethod: PaymentMethodEnum.COD },
        { reference: { $regex: /^COD/i } },
        { description: { $regex: /COD|دفع عند الاستلام|كاش/i } },
      ],
    });
    const totalCodPlatformFees = codCommissionEntries.reduce(
      (sum, e) => sum + Math.abs(e.amount),
      0,
    );

    // 4. Settled payout debits from ledger (actual withdrawals)
    const settledPayoutEntries = await this.ledgerRepo.getAll({
      sellingEntityId: entityId,
      entryType: LedgerMovementTypeEnum.PAYOUT_DEBIT,
      status: LedgerEntryStatusEnum.SETTLED,
    });
    const settledDebitsSum = settledPayoutEntries.reduce(
      (sum, e) => sum + Math.abs(e.amount),
      0,
    );

    // 5. Pending/processing payout requests that haven't finalized
    const pendingPayoutRequests = await this.payoutRequestRepo.getAll({
      sellingEntityId: entityId,
      status: {
        $in: [
          PayoutRequestStatusEnum.PENDING,
          PayoutRequestStatusEnum.PROCESSING,
        ],
      },
    });
    const pendingRequestsSum = pendingPayoutRequests.reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );

    // 5. Refund debits from ledger (returned order deductions)
    const refundDebitsEntries = await this.ledgerRepo.getAll({
      sellingEntityId: entityId,
      entryType: LedgerMovementTypeEnum.REFUND_DEBIT,
    });
    const totalRefundDebits = refundDebitsEntries.reduce(
      (sum, r) => sum + Math.abs(r.amount || 0),
      0,
    );

    // 6. Net Available Balance and Platform Dues:
    // Online earnings after refunds and existing withdrawals
    const netOnlineEarnings = Math.max(
      0,
      grossAvailableCredit - totalRefundDebits - settledDebitsSum - pendingRequestsSum,
    );

    let availableBalance = 0;
    let platformDues = 0;

    if (netOnlineEarnings >= totalCodPlatformFees) {
      availableBalance = netOnlineEarnings - totalCodPlatformFees;
      platformDues = 0;
    } else {
      availableBalance = 0;
      platformDues = totalCodPlatformFees - netOnlineEarnings;
    }

    availableBalance = Math.round(availableBalance * 100) / 100;
    platformDues = Math.round(platformDues * 100) / 100;

    // 7. Withdrawn Balance (settled/completed payouts)
    const completedPayouts = await this.payoutRequestRepo.getAll({
      sellingEntityId: entityId,
      status: PayoutRequestStatusEnum.COMPLETED,
    });
    const withdrawnFromRequests = completedPayouts.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    const withdrawnBalance = Math.max(
      settledDebitsSum,
      withdrawnFromRequests,
    );

    return {
      pendingBalance,
      availableBalance,
      withdrawnBalance: Math.round(withdrawnBalance * 100) / 100,
      platformDues,
      currency: 'EGP',
    };
  }

  /**
   * Get paginated ledger movements
   */
  async getLedger(
    entityId: Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<{
    entries: LedgerEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: Record<string, any> = { sellingEntityId: entityId };
    if (status && status !== 'ALL') {
      filter.status = status;
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [entries, total] = await Promise.all([
      this.ledgerRepo.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('orderId', 'orderNumber totalAmount status createdAt')
        .populate('entityOrderId', 'status subtotal commissionAmount')
        .lean()
        .exec(),
      this.ledgerRepo.model.countDocuments(filter),
    ]);

    return {
      entries: entries as LedgerEntry[],
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Request payout with validation and simulation
   */
  async requestPayout(
    entityId: Types.ObjectId,
    dto: RequestSellerPayoutDto,
  ): Promise<{
    success: boolean;
    message: string;
    payoutRequest: PayoutRequest;
    gatewayReference: string;
    newBalance: number;
  }> {
    const MINIMUM_PAYOUT = 500;
    if (dto.amount < MINIMUM_PAYOUT) {
      throw new BadRequestException(
        `الحد الأدنى لطلب سحب الأرباح هو ${MINIMUM_PAYOUT} ج.م`,
      );
    }

    if (!Types.ObjectId.isValid(dto.payoutMethodId)) {
      throw new BadRequestException('معرف وسيلة السحب غير صالح');
    }
    const methodId = new Types.ObjectId(dto.payoutMethodId);

    const payoutMethod = await this.payoutMethodRepo.getOne({
      _id: methodId,
      sellingEntityId: entityId,
    });
    if (!payoutMethod) {
      throw new NotFoundException(
        'وسيلة السحب المحددة غير مسجلة أو غير تابعة لهذا المتجر',
      );
    }

    const { availableBalance } = await this.getWalletBalance(entityId);
    if (dto.amount > availableBalance) {
      throw new BadRequestException(
        `رصيدك المتاح الحالي (${availableBalance.toLocaleString()} ج.م) غير كافٍ لسحب مبلغ (${dto.amount.toLocaleString()} ج.م)`,
      );
    }

    const newBalance = Math.max(
      0,
      Math.round((availableBalance - dto.amount) * 100) / 100,
    );
    const gatewayReference = `TRX-PAYOUT-${Date.now()}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const result = await runSafeTransaction(this.connection, async (session) => {
      const options = session ? { session } : undefined;

      const payoutDoc = await this.payoutRequestRepo.create(
        {
          sellingEntityId: entityId,
          amount: dto.amount,
          payoutMethodId: payoutMethod._id,
          payoutMethodSnapshot: {
            type: payoutMethod.type,
            details: payoutMethod.details,
          },
          status: PayoutRequestStatusEnum.COMPLETED,
          gatewayReference,
          requestedAt: new Date(),
          processedAt: new Date(),
        },
        options,
      );

      const methodLabel =
        payoutMethod.type === PayoutMethodTypeEnum.BANK_ACCOUNT
          ? `الحساب البنكي (${payoutMethod.details.bankName || ''})`
          : payoutMethod.type === PayoutMethodTypeEnum.VODAFONE_CASH
          ? `المحفظة الإلكترونية (${payoutMethod.details.walletNumber || ''})`
          : `إنستاباي (${payoutMethod.details.instaPayAddress || ''})`;

      // Append immutable Ledger Debit entry
      await this.ledgerRepo.create(
        {
          sellingEntityId: entityId,
          entryType: LedgerMovementTypeEnum.PAYOUT_DEBIT,
          account: LedgerAccountEnum.VENDOR_PAYABLE,
          type: LedgerEntryTypeEnum.DEBIT,
          amount: dto.amount,
          currency: 'EGP',
          balanceAfter: newBalance,
          status: LedgerEntryStatusEnum.SETTLED,
          reference: gatewayReference,
          description: `سحب أرباح وتحويل فوري إلى ${methodLabel} [مرجع: ${gatewayReference}]`,
        },
        options,
      );

      return payoutDoc;
    }, this.logger);

    return {
      success: true,
      message: `تم تنفيذ طلب سحب الأرباح بقيمة ${dto.amount.toLocaleString()} ج.م وتحويلها بنجاح`,
      payoutRequest: result,
      gatewayReference,
      newBalance,
    };
  }

  /**
   * Get all payout requests history
   */
  async getPayoutHistory(
    entityId: Types.ObjectId,
  ): Promise<PayoutRequest[]> {
    return this.payoutRequestRepo.model
      .find({ sellingEntityId: entityId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }
}

