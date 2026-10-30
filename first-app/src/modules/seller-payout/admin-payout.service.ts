import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { ReturnRequestRepo } from '../../models/return/return-request.repository';
import { PayoutRequestRepo } from '../../models/payout/payout-request.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
} from '../../models/ledger/ledger-entry.schema';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { PayoutRequestStatusEnum } from '../../models/payout/payout-request.schema';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';

export interface VendorFinancialSummaryLive {
  sellingEntityId: string;
  tradeName: string;
  currency: string;
  summary: {
    totalGrossSales: number;
    totalPlatformFees: number;
    heldEscrowBalance: number;
    availablePayoutBalance: number;
    totalRefundDebits: number;
    totalPayoutDebits: number;
    totalCodPlatformFees: number;
    outstandingCodDebt: number;
    totalEscrowRecords: number;
    totalPayoutBatches: number;
    totalLedgerEntries: number;
  };
  payoutHistory: any[];
}

export interface VendorPeriodReport {
  sellingEntityId: string;
  tradeName: string;
  currency: string;
  period: string;
  startDate: string;
  endDate: string;
  grossSales: number;
  platformFees: number;
  totalRefundedAmount: number;
  netVendorEarnings: number;
  completedOrdersCount: number;
  refundsCount: number;
  totalOrdersCount: number;
  orders: Array<{
    entityOrderId: string;
    subtotal: number;
    commissionAmount?: number;
    status: string;
    createdAt: string;
  }>;
}

export interface VendorDecisionAnalytics {
  returnRate: {
    totalOrders: number;
    returnOrders: number;
    ratePercentage: number;
    status: 'NORMAL' | 'WARNING';
    badge: string;
    decision: string;
    isAlert: boolean;
  };
  codDebt: {
    totalCodSales: number;
    totalCodPlatformFees: number;
    availableBalance: number;
    outstandingCodDebt: number;
    threshold: number;
    status: 'SAFE' | 'CRITICAL';
    badge: string;
    decision: string;
    recommendSuspendCod: boolean;
    isAlert: boolean;
  };
  fulfillmentVelocity: {
    deliveredOrdersAnalyzed: number;
    averageDeliveryHours: number;
    averageDeliveryDays: number;
    status: 'EXCELLENT' | 'GOOD' | 'SLOW' | 'INSUFFICIENT_DATA';
    badge: string;
    decision: string;
    isTopSellerPriority: boolean;
  };
}

@Injectable()
export class AdminPayoutService {
  private readonly logger = new Logger(AdminPayoutService.name);

  constructor(
    private readonly ledgerRepo: LedgerRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly entityOrderRepo: EntityOrderRepo,
    private readonly returnRequestRepo: ReturnRequestRepo,
    private readonly payoutRequestRepo: PayoutRequestRepo,
    private readonly escrowRepo: EscrowRepo,
  ) {}

  /**
   * Helper to resolve entity ObjectId
   */
  private resolveObjectId(idOrStr: string | Types.ObjectId): Types.ObjectId {
    if (!idOrStr) {
      throw new BadRequestException('معرف الكيان التجاري مطلوب');
    }
    const str = idOrStr.toString();
    if (!Types.ObjectId.isValid(str)) {
      throw new BadRequestException(`معرف الكيان التجاري غير صالح: ${str}`);
    }
    return new Types.ObjectId(str);
  }

  /**
   * 1. Live Accounting Calculation from LedgerEntry
   */
  async getLiveVendorFinancialSummary(
    entityIdOrStr: string | Types.ObjectId,
  ): Promise<VendorFinancialSummaryLive> {
    const entityId = this.resolveObjectId(entityIdOrStr);
    const entity = await this.sellingEntityRepo.getOne({ _id: entityId });
    if (!entity) {
      throw new NotFoundException('الكيان التجاري غير موجود');
    }
    const tradeName = (entity as any).tradeName || entity.legalName || 'المتجر';

    // 1. Live Aggregation Pipeline directly from LedgerEntry
    const [ledgerAgg] = await this.ledgerRepo.model.aggregate([
      { $match: { sellingEntityId: entityId } },
      {
        $group: {
          _id: null,
          totalGrossSales: {
            $sum: {
              $cond: [
                { $eq: ['$entryType', LedgerMovementTypeEnum.ORDER_CREDIT] },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          availableOrderCredits: {
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
          totalPlatformFees: {
            $sum: {
              $cond: [
                { $eq: ['$entryType', LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT] },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          totalCodPlatformFees: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$entryType', LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT] },
                    {
                      $or: [
                        { $eq: ['$paymentMethod', 'COD'] },
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
          totalRefundDebits: {
            $sum: {
              $cond: [
                { $eq: ['$entryType', LedgerMovementTypeEnum.REFUND_DEBIT] },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          totalPayoutDebits: {
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
        },
      },
    ]);

    let totalGrossSales = ledgerAgg?.totalGrossSales || 0;
    let availableOrderCredits = ledgerAgg?.availableOrderCredits || 0;
    let heldEscrowBalance = ledgerAgg?.heldEscrowBalance || 0;
    const totalPlatformFees = ledgerAgg?.totalPlatformFees || 0;
    const totalCodPlatformFees = ledgerAgg?.totalCodPlatformFees || 0;
    const totalRefundDebits = ledgerAgg?.totalRefundDebits || 0;
    const totalPayoutDebits = ledgerAgg?.totalPayoutDebits || 0;

    // Fallback: If no order credit ledger entries exist yet, inspect Escrow collection
    if (totalGrossSales === 0 && heldEscrowBalance === 0) {
      const escrows = await this.escrowRepo.getAll({ sellingEntityId: entityId });
      for (const e of escrows) {
        totalGrossSales += e.grossAmount || 0;
        if (e.status === EscrowStatusEnum.HELD) {
          heldEscrowBalance += e.netAmount || 0;
        } else if (e.status === EscrowStatusEnum.RELEASED) {
          availableOrderCredits += e.netAmount || 0;
        }
      }
    }

    // Pending payout requests holding funds
    const pendingRequests = await this.payoutRequestRepo.getAll({
      sellingEntityId: entityId,
      status: {
        $in: [
          PayoutRequestStatusEnum.PENDING,
          PayoutRequestStatusEnum.PROCESSING,
        ],
      },
    });
    const pendingRequestsSum = pendingRequests.reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );

    // Precise Available Balance formula:
    // Available Balance = SUM(AVAILABLE ORDER_CREDIT) - SUM(REFUND_DEBIT) - SUM(PAYOUT_DEBIT) - SUM(COD Dues)
    const netCreditEarnings =
      availableOrderCredits - totalRefundDebits - totalPayoutDebits - pendingRequestsSum;

    let availablePayoutBalance = 0;
    let outstandingCodDebt = 0;

    if (netCreditEarnings >= totalCodPlatformFees) {
      availablePayoutBalance = netCreditEarnings - totalCodPlatformFees;
      outstandingCodDebt = 0;
    } else {
      availablePayoutBalance = 0;
      outstandingCodDebt = totalCodPlatformFees - Math.max(0, netCreditEarnings);
    }

    // Payout History
    const payoutHistory = await this.payoutRequestRepo.model
      .find({ sellingEntityId: entityId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const totalEscrowRecords = await this.escrowRepo.model.countDocuments({
      sellingEntityId: entityId,
    });

    const totalLedgerEntries = await this.ledgerRepo.model.countDocuments({
      sellingEntityId: entityId,
    });

    return {
      sellingEntityId: entityId.toString(),
      tradeName,
      currency: 'EGP',
      summary: {
        totalGrossSales: Math.round(totalGrossSales * 100) / 100,
        totalPlatformFees: Math.round(totalPlatformFees * 100) / 100,
        heldEscrowBalance: Math.round(heldEscrowBalance * 100) / 100,
        availablePayoutBalance: Math.round(availablePayoutBalance * 100) / 100,
        totalRefundDebits: Math.round(totalRefundDebits * 100) / 100,
        totalPayoutDebits: Math.round(totalPayoutDebits * 100) / 100,
        totalCodPlatformFees: Math.round(totalCodPlatformFees * 100) / 100,
        outstandingCodDebt: Math.round(outstandingCodDebt * 100) / 100,
        totalEscrowRecords,
        totalPayoutBatches: payoutHistory.length,
        totalLedgerEntries,
      },
      payoutHistory,
    };
  }

  /**
   * 2. Vendor Financial Reports with Time Filtering
   */
  async getVendorPeriodReport(
    entityIdOrStr: string | Types.ObjectId,
    query: {
      period?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<VendorPeriodReport> {
    const entityId = this.resolveObjectId(entityIdOrStr);
    const entity = await this.sellingEntityRepo.getOne({ _id: entityId });
    if (!entity) {
      throw new NotFoundException('الكيان التجاري غير موجود');
    }
    const tradeName = (entity as any).tradeName || entity.legalName || 'المتجر';

    // Parse date window
    const now = new Date();
    let start: Date;
    let end: Date;

    const period = (query.period || 'month').toLowerCase();
    if (period === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (period === 'custom' && query.startDate) {
      start = new Date(query.startDate);
      end = query.endDate ? new Date(query.endDate) : new Date();
    } else {
      // default: month
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const dateFilter = {
      createdAt: { $gte: start, $lte: end },
    };

    // 1. Orders within period
    const orders = await this.entityOrderRepo.model
      .find({
        sellingEntityId: entityId,
        ...dateFilter,
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const totalOrdersCount = orders.length;
    const completedOrdersCount = orders.filter(
      (o) => o.status === EntityOrderStatusEnum.DELIVERED,
    ).length;

    // 2. Ledger entries within period
    const ledgerEntries = await this.ledgerRepo.model
      .find({
        sellingEntityId: entityId,
        ...dateFilter,
      })
      .lean()
      .exec();

    let grossSales = 0;
    let platformFees = 0;
    let totalRefundedAmount = 0;

    for (const entry of ledgerEntries) {
      const amt = Math.abs(entry.amount || 0);
      if (entry.entryType === LedgerMovementTypeEnum.ORDER_CREDIT) {
        grossSales += amt;
      } else if (entry.entryType === LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT) {
        platformFees += amt;
      } else if (entry.entryType === LedgerMovementTypeEnum.REFUND_DEBIT) {
        totalRefundedAmount += amt;
      }
    }

    // Fallback: If no order credit in ledger, sum orders subtotal
    if (grossSales === 0 && orders.length > 0) {
      grossSales = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    }

    // 3. Returns in period
    const returnRequests = await this.returnRequestRepo.model
      .find({
        sellingEntityId: entityId,
        ...dateFilter,
      })
      .lean()
      .exec();

    const refundsCount = returnRequests.length;
    if (totalRefundedAmount === 0 && returnRequests.length > 0) {
      totalRefundedAmount = returnRequests.reduce(
        (sum, r) => sum + (r.refundAmount || 0),
        0,
      );
    }

    const netVendorEarnings = Math.max(
      0,
      Math.round((grossSales - platformFees - totalRefundedAmount) * 100) / 100,
    );

    return {
      sellingEntityId: entityId.toString(),
      tradeName,
      currency: 'EGP',
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      grossSales: Math.round(grossSales * 100) / 100,
      platformFees: Math.round(platformFees * 100) / 100,
      totalRefundedAmount: Math.round(totalRefundedAmount * 100) / 100,
      netVendorEarnings,
      completedOrdersCount,
      refundsCount,
      totalOrdersCount,
      orders: orders.map((o) => ({
        entityOrderId: o._id.toString(),
        subtotal: o.subtotal || 0,
        status: o.status,
        createdAt: (o as any).createdAt ? new Date((o as any).createdAt).toISOString() : '',
      })),
    };
  }

  /**
   * 3. Decision-Making Analytics Engine
   */
  async getVendorDecisionAnalytics(
    entityIdOrStr: string | Types.ObjectId,
  ): Promise<VendorDecisionAnalytics> {
    const entityId = this.resolveObjectId(entityIdOrStr);

    // 1. Return Rate: (عدد الطلبات المرتجعة ÷ إجمالي الطلبات) × 100
    const [totalOrders, returnOrders] = await Promise.all([
      this.entityOrderRepo.model.countDocuments({ sellingEntityId: entityId }),
      this.returnRequestRepo.model.countDocuments({ sellingEntityId: entityId }),
    ]);

    const ratePercentage =
      totalOrders > 0
        ? Math.round((returnOrders / totalOrders) * 1000) / 10
        : 0;

    const isReturnAlert = ratePercentage > 10;
    const returnRate: VendorDecisionAnalytics['returnRate'] = {
      totalOrders,
      returnOrders,
      ratePercentage,
      status: isReturnAlert ? 'WARNING' : 'NORMAL',
      badge: isReturnAlert ? `مرتفع (${ratePercentage}%)` : `طبيعي (${ratePercentage}%)`,
      decision: isReturnAlert
        ? 'معدل مرتجعات مرتفع يتجاوز 10% - يتطلب مراجعة جودة منتجات التاجر والتدقيق في أسباب الإرجاع'
        : 'معدل المرتجعات ضمن الحدود الطبيعية المقبولة للمنصة (أقل من 10%)',
      isAlert: isReturnAlert,
    };

    // 2. COD Debt Index: مجموع عمولات المنصة المستحقة على مبيعات الدفع عند الاستلام
    const liveSummary = await this.getLiveVendorFinancialSummary(entityId);
    const { totalCodPlatformFees, availablePayoutBalance, outstandingCodDebt } =
      liveSummary.summary;
    const COD_DEBT_THRESHOLD = 1000;

    const isCodAlert = outstandingCodDebt >= COD_DEBT_THRESHOLD;
    const codDebt: VendorDecisionAnalytics['codDebt'] = {
      totalCodSales: liveSummary.summary.totalGrossSales,
      totalCodPlatformFees,
      availableBalance: availablePayoutBalance,
      outstandingCodDebt,
      threshold: COD_DEBT_THRESHOLD,
      status: isCodAlert ? 'CRITICAL' : 'SAFE',
      badge: isCodAlert
        ? `مديونية حرجة (${outstandingCodDebt.toLocaleString()} ج.م)`
        : `حساب منتظم (${outstandingCodDebt.toLocaleString()} ج.م)`,
      decision: isCodAlert
        ? `تجاوزت مديونية عمولات الدفع عند الاستلام الحد الأقصى (${COD_DEBT_THRESHOLD.toLocaleString()} ج.م) - يوصى بإيقاف ميزة الـ COD مؤقتاً لحين سداد العمولات`
        : 'مديونية عمولات الدفع عند الاستلام منتظمة ومغطاة ضمن حدود الائتمان المقبولة',
      recommendSuspendCod: isCodAlert,
      isAlert: isCodAlert,
    };

    // 3. Fulfillment Velocity: متوسط الوقت بين حالة CONFIRMED وحالة DELIVERED
    const deliveredOrders = await this.entityOrderRepo.model
      .find({
        sellingEntityId: entityId,
        status: EntityOrderStatusEnum.DELIVERED,
      })
      .lean()
      .exec();

    let totalDurationMs = 0;
    let countedDeliveredOrders = 0;

    for (const order of deliveredOrders) {
      let confirmedDate: Date | null = null;
      let deliveredDate: Date | null = null;

      if (order.statusHistory && Array.isArray(order.statusHistory)) {
        for (const history of order.statusHistory) {
          if (history.status === EntityOrderStatusEnum.CONFIRMED && !confirmedDate) {
            confirmedDate = new Date(history.updatedAt);
          }
          if (history.status === EntityOrderStatusEnum.DELIVERED) {
            deliveredDate = new Date(history.updatedAt);
          }
        }
      }

      // Fallback timestamps
      if (!confirmedDate && (order as any).createdAt) {
        confirmedDate = new Date((order as any).createdAt);
      }
      if (!deliveredDate && (order as any).updatedAt) {
        deliveredDate = new Date((order as any).updatedAt);
      }

      if (confirmedDate && deliveredDate && deliveredDate > confirmedDate) {
        totalDurationMs += deliveredDate.getTime() - confirmedDate.getTime();
        countedDeliveredOrders += 1;
      }
    }

    let averageDeliveryHours = 0;
    let averageDeliveryDays = 0;
    let velocityStatus: VendorDecisionAnalytics['fulfillmentVelocity']['status'] =
      'INSUFFICIENT_DATA';
    let velocityBadge = 'لا توجد بيانات كافية';
    let velocityDecision = 'لم يتم تسليم عدد كافٍ من الطلبات لتقييم سرعة الشحن والتسليم';
    let isTopSellerPriority = false;

    if (countedDeliveredOrders > 0) {
      const avgMs = totalDurationMs / countedDeliveredOrders;
      averageDeliveryHours = Math.round(avgMs / (1000 * 60 * 60));
      averageDeliveryDays = Math.round((averageDeliveryHours / 24) * 10) / 10;

      if (averageDeliveryHours <= 48) {
        velocityStatus = 'EXCELLENT';
        velocityBadge = `سرعة استثنائية (${averageDeliveryHours} س / ${averageDeliveryDays} يوم)`;
        velocityDecision =
          'تاجر مميز - سرعة تسليم فائقة (خلال 48 ساعة). يُمنح أولوية الظهور في المتجر والترويج';
        isTopSellerPriority = true;
      } else if (averageDeliveryHours <= 96) {
        velocityStatus = 'GOOD';
        velocityBadge = `سرعة جيدة (${averageDeliveryDays} يوم)`;
        velocityDecision =
          'معدل سرعة التسليم منتظم وضمن المعايير القياسية المعتمدة للمنصة';
        isTopSellerPriority = false;
      } else {
        velocityStatus = 'SLOW';
        velocityBadge = `بطء في التسليم (${averageDeliveryDays} يوم)`;
        velocityDecision =
          'تأخير في تسليم الطلبات يتجاوز 4 أيام - يوصى بتنبيه التاجر لتحسين سرعة التجهيز والشحن';
        isTopSellerPriority = false;
      }
    }

    const fulfillmentVelocity: VendorDecisionAnalytics['fulfillmentVelocity'] = {
      deliveredOrdersAnalyzed: countedDeliveredOrders,
      averageDeliveryHours,
      averageDeliveryDays,
      status: velocityStatus,
      badge: velocityBadge,
      decision: velocityDecision,
      isTopSellerPriority,
    };

    return {
      returnRate,
      codDebt,
      fulfillmentVelocity,
    };
  }

  /**
   * Combined report and analytics endpoint
   */
  async getFullVendorReportAndAnalytics(
    entityIdOrStr: string | Types.ObjectId,
    query: {
      period?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const entityId = this.resolveObjectId(entityIdOrStr);
    const [financialSummary, periodReport, decisionAnalytics] = await Promise.all([
      this.getLiveVendorFinancialSummary(entityId),
      this.getVendorPeriodReport(entityId, query),
      this.getVendorDecisionAnalytics(entityId),
    ]);

    return {
      financialSummary,
      periodReport,
      decisionAnalytics,
    };
  }

  /**
   * Generate CSV format for vendor report
   */
  async generateVendorReportCsv(
    entityIdOrStr: string | Types.ObjectId,
    query: {
      period?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<string> {
    const fullData = await this.getFullVendorReportAndAnalytics(entityIdOrStr, query);
    const { financialSummary, periodReport, decisionAnalytics } = fullData;

    const rows: string[] = [];
    // UTF-8 BOM for Arabic Excel support
    const BOM = '\uFEFF';

    rows.push('تقرير التسويات المالية وتحليلات الأداء للتاجر');
    rows.push(`اسم المتجر / الكيان,${financialSummary.tradeName}`);
    rows.push(`معرف الكيان,${financialSummary.sellingEntityId}`);
    rows.push(`العملة,ج.م (EGP)`);
    rows.push(`الفترة المحددة,${periodReport.period}`);
    rows.push(`من تاريخ,${periodReport.startDate}`);
    rows.push(`إلى تاريخ,${periodReport.endDate}`);
    rows.push('');

    rows.push('--- المؤشرات المالية للفترة الزمنية ---');
    rows.push(`إجمالي المبيعات (Gross Sales),${periodReport.grossSales} ج.م`);
    rows.push(`عمولات المنصة المستقطعة (Platform Fees),${periodReport.platformFees} ج.م`);
    rows.push(`إجمالي المبالغ المستردة (Refunds),${periodReport.totalRefundedAmount} ج.م`);
    rows.push(`صافي مستحقات التاجر (Net Vendor Earnings),${periodReport.netVendorEarnings} ج.م`);
    rows.push(`عدد الطلبات المكتملة,${periodReport.completedOrdersCount}`);
    rows.push(`عدد المرتجعات,${periodReport.refundsCount}`);
    rows.push(`إجمالي الطلبات,${periodReport.totalOrdersCount}`);
    rows.push('');

    rows.push('--- دفتر الأستاذ الحي ومستحقات الصرف الإجمالية ---');
    rows.push(`إجمالي المبيعات التاريخية (Gross Sales),${financialSummary.summary.totalGrossSales} ج.م`);
    rows.push(`إجمالي عمولات المنصة,${financialSummary.summary.totalPlatformFees} ج.م`);
    rows.push(`رصيد الضمان المعلق (Held Escrow),${financialSummary.summary.heldEscrowBalance} ج.م`);
    rows.push(`الرصيد المتاح للصرف الفوري (Available Payout),${financialSummary.summary.availablePayoutBalance} ج.م`);
    rows.push(`إجمالي المبالغ المسحوبة سابقاً,${financialSummary.summary.totalPayoutDebits} ج.م`);
    rows.push(`مديونية عمولات الدفع عند الاستلام غير المغطاة,${financialSummary.summary.outstandingCodDebt} ج.م`);
    rows.push('');

    rows.push('--- محرك التحليلات الذكية ودعم القرار ---');
    rows.push(`معدل الارتجاع (Return Rate),${decisionAnalytics.returnRate.ratePercentage}%,${decisionAnalytics.returnRate.decision}`);
    rows.push(`مؤشر مديونية الـ COD,${decisionAnalytics.codDebt.outstandingCodDebt} ج.م,${decisionAnalytics.codDebt.decision}`);
    rows.push(`سرعة تنفيذ وتسليم الطلبات,${decisionAnalytics.fulfillmentVelocity.averageDeliveryHours} ساعة (${decisionAnalytics.fulfillmentVelocity.averageDeliveryDays} يوم),${decisionAnalytics.fulfillmentVelocity.decision}`);
    rows.push('');

    rows.push('--- قائمة طلبات الفترة ---');
    rows.push('معرف الطلب,المبلغ (ج.م),الحالة,تاريخ الطلب');
    for (const order of periodReport.orders) {
      rows.push(
        `"${order.entityOrderId}",${order.subtotal},"${order.status}","${order.createdAt}"`,
      );
    }

    return BOM + rows.join('\r\n');
  }
}

