import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Permission } from '../../common/enums/permission.enum';
import { RolesEnum } from '../../common/enums/roles';
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
   * Resolve sellingEntityId from explicit string or from user ownerId, enforcing tenant ownership
   */
  async resolveSellingEntityId(
    sellingEntityIdOrOwnerId?: string,
    ownerId?: string,
    currentUser?: any,
  ): Promise<Types.ObjectId> {
    if (
      sellingEntityIdOrOwnerId &&
      Types.ObjectId.isValid(sellingEntityIdOrOwnerId)
    ) {
      const entity = await this.sellingEntityRepo.getOne({
        _id: new Types.ObjectId(sellingEntityIdOrOwnerId),
      });
      if (entity) {
        if (currentUser) {
          const role = (currentUser.role || '').toLowerCase();
          const isSuperAdmin =
            role === 'admin' ||
            role === 'super_admin' ||
            role === RolesEnum.SUPER_ADMIN.toLowerCase() ||
            currentUser.permissions?.includes(Permission.PAYOUT_READ_ALL) ||
            currentUser.permissions?.includes('payout.read_all');
          const callerId = (currentUser.id || currentUser.sub || currentUser._id || ownerId)?.toString();
          const isOwner =
            (entity.primaryOwnerId && entity.primaryOwnerId.toString() === callerId) ||
            (currentUser.sellingEntityId && currentUser.sellingEntityId.toString() === entity._id.toString());
          if (!isSuperAdmin && !isOwner) {
            throw new ForbiddenException('غير مصرح لك بالوصول إلى بيانات متجر آخر');
          }
        }
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
    // 1. Live Aggregation Pipeline directly from LedgerEntry
    const [ledgerAgg] = await this.ledgerRepo.model.aggregate([
      { $match: { sellingEntityId: entityId } },
      {
        $group: {
          _id: null,
          availableOrderCredit: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$entryType', LedgerMovementTypeEnum.ORDER_CREDIT] },
                    { $eq: ['$status', LedgerEntryStatusEnum.AVAILABLE] },
                  ],
                },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          heldEscrowBalance: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$entryType', LedgerMovementTypeEnum.ORDER_CREDIT] },
                    { $eq: ['$status', LedgerEntryStatusEnum.HELD_ESCROW] },
                  ],
                },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          refundDebit: {
            $sum: {
              $cond: [
                { $eq: ['$entryType', LedgerMovementTypeEnum.REFUND_DEBIT] },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          payoutDebit: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$entryType', LedgerMovementTypeEnum.PAYOUT_DEBIT] },
                    {
                      $in: [
                        '$status',
                        [
                          LedgerEntryStatusEnum.SETTLED,
                          LedgerEntryStatusEnum.AVAILABLE,
                        ],
                      ],
                    },
                  ],
                },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          codDues: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: [
                        '$entryType',
                        LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
                      ],
                    },
                    {
                      $or: [
                        { $eq: ['$paymentMethod', PaymentMethodEnum.COD] },
                        {
                          $regexMatch: {
                            input: { $ifNull: ['$reference', ''] },
                            regex: /^COD/i,
                          },
                        },
                        {
                          $regexMatch: {
                            input: { $ifNull: ['$description', ''] },
                            regex: /COD|دفع عند الاستلام|كاش/i,
                          },
                        },
                      ],
                    },
                  ],
                },
                { $abs: '$amount' },
                0,
              ],
            },
          },
        },
      },
    ]);

    let availableOrderCredit = ledgerAgg?.availableOrderCredit || 0;
    let heldEscrowBalance = ledgerAgg?.heldEscrowBalance || 0;
    const refundDebit = ledgerAgg?.refundDebit || 0;
    const payoutDebit = ledgerAgg?.payoutDebit || 0;
    const codDues = ledgerAgg?.codDues || 0;

    // Fallback: Check Escrow collection ONLY if no order credit ledger entries exist yet
    if (availableOrderCredit === 0 && heldEscrowBalance === 0) {
      const escrows = await this.escrowRepo.getAll({
        sellingEntityId: entityId,
      });
      for (const e of escrows) {
        if (e.status === EscrowStatusEnum.HELD) {
          heldEscrowBalance += e.netAmount || 0;
        } else if (e.status === EscrowStatusEnum.RELEASED) {
          availableOrderCredit += e.netAmount || 0;
        }
      }
    }

    // Pending payout requests that haven't finalized
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

    // Precise live settlement formula:
    // Available Balance = SUM(AVAILABLE ORDER_CREDIT) - SUM(REFUND_DEBIT) - SUM(PAYOUT_DEBIT) - SUM(COD Dues)
    const netCreditAvailable =
      availableOrderCredit - refundDebit - payoutDebit - pendingRequestsSum;

    let availableBalance = 0;
    let platformDues = 0;

    if (netCreditAvailable >= codDues) {
      availableBalance = netCreditAvailable - codDues;
      platformDues = 0;
    } else {
      availableBalance = 0;
      platformDues = codDues - Math.max(0, netCreditAvailable);
    }

    // Completed payouts for total withdrawn balance
    const completedPayouts = await this.payoutRequestRepo.getAll({
      sellingEntityId: entityId,
      status: PayoutRequestStatusEnum.COMPLETED,
    });
    const withdrawnFromRequests = completedPayouts.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );
    const withdrawnBalance = Math.max(payoutDebit, withdrawnFromRequests);

    return {
      pendingBalance: Math.max(0, Math.round(heldEscrowBalance * 100) / 100),
      availableBalance: Math.max(0, Math.round(availableBalance * 100) / 100),
      withdrawnBalance: Math.round(withdrawnBalance * 100) / 100,
      platformDues: Math.round(platformDues * 100) / 100,
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
   * Get paginated ledger movements (alias for getLedger)
   */
  async getLedgerHistory(
    entityId: Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ) {
    return this.getLedger(entityId, page, limit, status);
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

    const activePending = await this.payoutRequestRepo.getOne({
      sellingEntityId: entityId,
      status: {
        $in: [
          PayoutRequestStatusEnum.PENDING,
          PayoutRequestStatusEnum.PROCESSING,
        ],
      },
    });
    if (activePending) {
      throw new BadRequestException(
        'يوجد طلب سحب أرباح قيد المعالجة حالياً. يرجى الانتظار حتى اكتمال الطلب السابق',
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

  /**
   * Process payout request (Admin Action: Approve / Reject)
   */
  async processPayout(
    payoutRequestId: string | Types.ObjectId,
    action: 'APPROVE' | 'REJECT',
    notes?: string,
  ): Promise<{
    success: boolean;
    message: string;
    payoutRequest: PayoutRequest;
  }> {
    const pId =
      typeof payoutRequestId === 'string'
        ? new Types.ObjectId(payoutRequestId)
        : payoutRequestId;

    const payout = await this.payoutRequestRepo.getOne({ _id: pId });
    if (!payout) {
      throw new NotFoundException('طلب السحب غير موجود');
    }

    if (
      payout.status !== PayoutRequestStatusEnum.PENDING &&
      payout.status !== PayoutRequestStatusEnum.PROCESSING
    ) {
      throw new BadRequestException(
        'لا يمكن معالجة هذا الطلب لأنه مكتمل أو مرفوض بالفعل',
      );
    }

    if (action === 'APPROVE') {
      await this.payoutRequestRepo.updateOne(
        { _id: pId },
        {
          status: PayoutRequestStatusEnum.COMPLETED,
          processedAt: new Date(),
          adminNotes: notes,
        },
      );

      // Settle ledger entry upon approval
      if (payout.gatewayReference) {
        await this.ledgerRepo.model.updateOne(
          {
            reference: payout.gatewayReference,
            entryType: LedgerMovementTypeEnum.PAYOUT_DEBIT,
          },
          {
            $set: { status: LedgerEntryStatusEnum.SETTLED },
          },
        );
      }

      return {
        success: true,
        message: 'تمت الموافقة على طلب السحب بنجاح',
        payoutRequest: (await this.payoutRequestRepo.getOne({ _id: pId }))!,
      };
    } else {
      // REJECT
      await this.payoutRequestRepo.updateOne(
        { _id: pId },
        {
          status: PayoutRequestStatusEnum.REJECTED,
          processedAt: new Date(),
          adminNotes: notes,
        },
      );

      // Create REVERSAL_CREDIT ledger entry upon rejection
      await this.ledgerRepo.create({
        sellingEntityId: payout.sellingEntityId,
        entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
        account: LedgerAccountEnum.VENDOR_PAYABLE,
        type: LedgerEntryTypeEnum.CREDIT,
        amount: payout.amount,
        currency: 'EGP',
        status: LedgerEntryStatusEnum.AVAILABLE,
        reference: `REV-${payout.gatewayReference || pId.toString()}`,
        description: `استرداد وإلغاء طلب السحب المرفوض: ${notes || ''}`,
      });

      return {
        success: true,
        message: 'تم رفض طلب السحب وإعادة الرصيد إلى محفظة البائع',
        payoutRequest: (await this.payoutRequestRepo.getOne({ _id: pId }))!,
      };
    }
  }
}

