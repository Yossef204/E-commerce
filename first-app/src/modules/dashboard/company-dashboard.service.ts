import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { PayoutRequestRepo } from '../../models/payout/payout-request.repository';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
} from '../../models/ledger/ledger-entry.schema';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { PayoutRequestStatusEnum } from '../../models/payout/payout-request.schema';

export interface CompanyDashboardOverviewQuery {
  period?: 'day' | 'month' | 'year' | string;
}

@Injectable()
export class CompanyDashboardService {
  constructor(
    private readonly entityOrderRepo: EntityOrderRepo,
    private readonly productRepo: ProductRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly ledgerRepo: LedgerRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly payoutRequestRepo: PayoutRequestRepo,
  ) {}

  /**
   * Helper to resolve entity ObjectId
   */
  async resolveSellingEntityId(
    entityIdOrStr?: string,
    currentUser?: any,
  ): Promise<Types.ObjectId> {
    const rawId =
      entityIdOrStr ||
      currentUser?.sellingEntityId ||
      currentUser?.entityId;

    if (rawId && Types.ObjectId.isValid(rawId.toString())) {
      return new Types.ObjectId(rawId.toString());
    }

    const userId =
      currentUser?.id ||
      currentUser?.sub ||
      currentUser?._id;

    if (userId && Types.ObjectId.isValid(userId.toString())) {
      const entity = await this.sellingEntityRepo.getOne({
        primaryOwnerId: new Types.ObjectId(userId.toString()),
      });
      if (entity?._id) {
        return entity._id;
      }
    }

    throw new BadRequestException('معرف الكيان التجاري غير صالح أو غير مرتبط بالمستخدم');
  }

  /**
   * GET /company/dashboard/overview
   * Returns all 5 fundamental elements in a single optimized response
   */
  async getOverview(
    sellingEntityId: Types.ObjectId,
    query: CompanyDashboardOverviewQuery,
  ) {
    const period = (query.period || 'month').toLowerCase();

    // 1. Calculate date boundaries for period filtering
    const now = new Date();
    let startDate: Date;

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    } else {
      // Default 'month'
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    }

    // Pipeline 1: Sales Summary with period filtering
    const [salesAgg] = await this.entityOrderRepo.model.aggregate([
      {
        $match: {
          sellingEntityId,
          createdAt: { $gte: startDate },
          status: { $ne: EntityOrderStatusEnum.CANCELLED },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$subtotal' },
          ordersCount: { $sum: 1 },
          avgOrderValue: { $avg: '$subtotal' },
        },
      },
    ]);

    const salesSummary = {
      period,
      startDate,
      totalSales: Math.round((salesAgg?.totalSales || 0) * 100) / 100,
      ordersCount: salesAgg?.ordersCount || 0,
      avgOrderValue: Math.round((salesAgg?.avgOrderValue || 0) * 100) / 100,
      currency: 'EGP',
    };

    // Pipeline 2: Orders Requiring Action (New, Pending, Processing)
    const [actionOrdersAgg] = await this.entityOrderRepo.model.aggregate([
      {
        $match: {
          sellingEntityId,
          status: {
            $in: [
              EntityOrderStatusEnum.PENDING,
              EntityOrderStatusEnum.CONFIRMED,
              EntityOrderStatusEnum.PROCESSING,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ['$status', EntityOrderStatusEnum.PENDING] }, 1, 0],
            },
          },
          confirmedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', EntityOrderStatusEnum.CONFIRMED] }, 1, 0],
            },
          },
          processingCount: {
            $sum: {
              $cond: [{ $eq: ['$status', EntityOrderStatusEnum.PROCESSING] }, 1, 0],
            },
          },
          totalRequiringAction: { $sum: 1 },
        },
      },
    ]);

    const ordersRequiringAction = {
      pending: actionOrdersAgg?.pendingCount || 0,
      confirmed: actionOrdersAgg?.confirmedCount || 0,
      processing: actionOrdersAgg?.processingCount || 0,
      total: actionOrdersAgg?.totalRequiringAction || 0,
    };

    // Pipeline 3: Pending Approvals (Products pending admin review)
    const pendingProductsCount = await this.productRepo.model.countDocuments({
      sellingEntityId,
      approvalStatus: ProductApprovalStatusEnum.PENDING_APPROVAL,
    });

    const pendingApprovals = {
      pendingProductsCount,
      requiresAction: pendingProductsCount > 0,
    };

    // Pipeline 4: Low Stock Alerts (Products and Variants at or below threshold <= 5)
    const lowStockThreshold = 5;
    const lowStockItems = await this.inventoryRepo.model.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $match: {
          'product.sellingEntityId': sellingEntityId,
          availableStock: { $lte: lowStockThreshold },
        },
      },
      {
        $project: {
          _id: 1,
          sku: 1,
          availableStock: 1,
          productId: '$product._id',
          productTitle: '$product.title',
        },
      },
      { $limit: 10 },
    ]);

    const lowStockAlerts = {
      threshold: lowStockThreshold,
      count: lowStockItems.length,
      items: lowStockItems,
      hasAlert: lowStockItems.length > 0,
    };

    // Pipeline 5: Financial Balances (Live Ledger Aggregation: Held Escrow, Available Payout, COD Dues)
    const [ledgerAgg] = await this.ledgerRepo.model.aggregate([
      { $match: { sellingEntityId } },
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
                        [LedgerEntryStatusEnum.SETTLED, LedgerEntryStatusEnum.AVAILABLE],
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
                    { $eq: ['$entryType', LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT] },
                    {
                      $or: [
                        { $eq: ['$paymentMethod', PaymentMethodEnum.COD] },
                        { $regexMatch: { input: { $ifNull: ['$reference', ''] }, regex: /^COD/i } },
                        { $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: /COD|دفع عند الاستلام|كاش/i } },
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

    const availableOrderCredit = ledgerAgg?.availableOrderCredit || 0;
    const heldEscrowBalance = ledgerAgg?.heldEscrowBalance || 0;
    const refundDebit = ledgerAgg?.refundDebit || 0;
    const payoutDebit = ledgerAgg?.payoutDebit || 0;
    const codDues = ledgerAgg?.codDues || 0;

    // Check pending payout requests
    const pendingRequests = await this.payoutRequestRepo.getAll({
      sellingEntityId,
      status: {
        $in: [PayoutRequestStatusEnum.PENDING, PayoutRequestStatusEnum.PROCESSING],
      },
    });
    const pendingRequestsSum = pendingRequests.reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );

    // Live settlement: Available = Available Credits - Refund Debits - Payout Debits - COD Dues - Pending Requests
    const netCredit = availableOrderCredit - refundDebit - payoutDebit - pendingRequestsSum;
    let availableBalance = 0;
    let codDebt = 0;

    if (netCredit >= codDues) {
      availableBalance = netCredit - codDues;
      codDebt = 0;
    } else {
      availableBalance = 0;
      codDebt = codDues - Math.max(0, netCredit);
    }

    const financialBalances = {
      heldEscrowBalance: Math.max(0, Math.round(heldEscrowBalance * 100) / 100),
      availablePayoutBalance: Math.max(0, Math.round(availableBalance * 100) / 100),
      codDebt: Math.round(codDebt * 100) / 100,
      currency: 'EGP',
    };

    return {
      success: true,
      data: {
        salesSummary,
        ordersRequiringAction,
        pendingApprovals,
        lowStockAlerts,
        financialBalances,
      },
    };
  }
}
