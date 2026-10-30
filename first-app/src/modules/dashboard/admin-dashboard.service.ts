import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../models/user/user.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import { PayoutRequestRepo } from '../../models/payout/payout-request.repository';
import { PaymentRepo } from '../../models/payment/payment.repository';
import { ReturnRequestRepo } from '../../models/return/return-request.repository';
import { EntityStatusEnum } from '../../common/enums/entity-status.enum';
import { EntityTypeEnum } from '../../common/enums/entity-type.enum';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
} from '../../models/ledger/ledger-entry.schema';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';
import { PayoutRequestStatusEnum } from '../../models/payout/payout-request.schema';
import { PaymentStatusEnum } from '../../common/enums/payment-status.enum';
import { ReturnStatusEnum } from '../../common/enums/return-status.enum';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly userRepo: UserRepo,
    private readonly productRepo: ProductRepo,
    private readonly ledgerRepo: LedgerRepo,
    private readonly escrowRepo: EscrowRepo,
    private readonly payoutRequestRepo: PayoutRequestRepo,
    private readonly paymentRepo: PaymentRepo,
    private readonly returnRequestRepo: ReturnRequestRepo,
  ) {}

  /**
   * GET /admin/dashboard/overview
   * Returns:
   * 1. Platform Overview: total orders, GMV, total users, total sellers.
   * 2. Approvals Center: pending company registrations, independent sellers, and products pending approval.
   * 3. Financial Health: total collected commissions, total held in escrow, volume of pending payout requests.
   * 4. Issues & Failures: failed financial transactions, unhandled webhooks, pending returns.
   */
  async getOverview() {
    // ----------------------------------------------------
    // 1. Platform Overview
    // ----------------------------------------------------
    const [gmvAgg] = await this.mainOrderRepo.model.aggregate([
      {
        $match: {
          status: { $ne: 'CANCELLED' },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalGmv: { $sum: '$totalAmount' },
        },
      },
    ]);

    const totalOrders = await this.mainOrderRepo.model.countDocuments();
    const gmv = Math.round((gmvAgg?.totalGmv || 0) * 100) / 100;

    const totalUsers = await this.userRepo.model.countDocuments();
    const totalSellers = await this.sellingEntityRepo.model.countDocuments();
    const activeStoresCount = await this.sellingEntityRepo.model.countDocuments({
      status: { $in: [EntityStatusEnum.ACTIVE, EntityStatusEnum.APPROVED] },
    });

    // Role breakdown
    const roleStats = await this.userRepo.model.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const roleMap: Record<string, number> = {};
    roleStats.forEach((r) => {
      if (r._id) roleMap[r._id] = r.count;
    });

    const platformOverview = {
      totalOrders,
      gmv,
      totalUsers,
      totalSellers,
      activeStoresCount,
      usersByRole: roleMap,
      currency: 'EGP',
    };

    // ----------------------------------------------------
    // 2. Approvals Center
    // ----------------------------------------------------
    const pendingCompanyRegistrations =
      await this.sellingEntityRepo.model.countDocuments({
        type: EntityTypeEnum.COMPANY,
        status: EntityStatusEnum.PENDING_APPROVAL,
      });

    const pendingIndependentSellers =
      await this.sellingEntityRepo.model.countDocuments({
        type: EntityTypeEnum.INDEPENDENT_SELLER,
        status: EntityStatusEnum.PENDING_APPROVAL,
      });

    const productsPendingApproval =
      await this.productRepo.model.countDocuments({
        approvalStatus: ProductApprovalStatusEnum.PENDING_APPROVAL,
      });

    const approvalsCenter = {
      pendingCompanyRegistrations,
      pendingIndependentSellers,
      productsPendingApproval,
      totalPendingApprovals:
        pendingCompanyRegistrations +
        pendingIndependentSellers +
        productsPendingApproval,
      requiresAttention:
        pendingCompanyRegistrations +
          pendingIndependentSellers +
          productsPendingApproval >
        0,
    };

    // ----------------------------------------------------
    // 3. Financial Health
    // ----------------------------------------------------
    // Total collected commissions from Ledger
    const [commissionAgg] = await this.ledgerRepo.model.aggregate([
      {
        $match: {
          entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
        },
      },
      {
        $group: {
          _id: null,
          totalCollectedCommissions: { $sum: { $abs: '$amount' } },
        },
      },
    ]);

    // Total held in Escrow from Ledger (or Escrow collection)
    const [escrowAgg] = await this.ledgerRepo.model.aggregate([
      {
        $match: {
          entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
          status: LedgerEntryStatusEnum.HELD_ESCROW,
        },
      },
      {
        $group: {
          _id: null,
          totalHeldEscrow: { $sum: { $abs: '$amount' } },
        },
      },
    ]);

    let totalHeldEscrow = escrowAgg?.totalHeldEscrow || 0;
    if (totalHeldEscrow === 0) {
      const heldEscrows = await this.escrowRepo.getAll({
        status: EscrowStatusEnum.HELD,
      });
      totalHeldEscrow = heldEscrows.reduce(
        (sum, e) => sum + (e.netAmount || 0),
        0,
      );
    }

    // Pending Payout Requests volume & count
    const [payoutRequestsAgg] = await this.payoutRequestRepo.model.aggregate([
      {
        $match: {
          status: {
            $in: [
              PayoutRequestStatusEnum.PENDING,
              PayoutRequestStatusEnum.PROCESSING,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          pendingPayoutRequestsVolume: { $sum: '$amount' },
          pendingPayoutRequestsCount: { $sum: 1 },
        },
      },
    ]);

    const financialHealth = {
      totalCollectedCommissions:
        Math.round((commissionAgg?.totalCollectedCommissions || 0) * 100) / 100,
      totalHeldEscrow: Math.round(totalHeldEscrow * 100) / 100,
      pendingPayoutRequestsVolume:
        Math.round(
          (payoutRequestsAgg?.pendingPayoutRequestsVolume || 0) * 100,
        ) / 100,
      pendingPayoutRequestsCount:
        payoutRequestsAgg?.pendingPayoutRequestsCount || 0,
      currency: 'EGP',
    };

    // ----------------------------------------------------
    // 4. Issues & Failures
    // ----------------------------------------------------
    const failedFinancialTransactions =
      await this.paymentRepo.model.countDocuments({
        status: PaymentStatusEnum.FAILED,
      });

    // Unhandled Webhooks / Stalled Pending Payments (> 1 hour old and still pending)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const unhandledWebhooks = await this.paymentRepo.model.countDocuments({
      status: PaymentStatusEnum.PENDING,
      createdAt: { $lte: oneHourAgo },
    });

    const pendingReturns = await this.returnRequestRepo.model.countDocuments({
      status: {
        $in: [
          ReturnStatusEnum.REQUESTED,
          ReturnStatusEnum.APPROVED_PENDING_SHIPMENT,
          ReturnStatusEnum.ITEM_RECEIVED,
        ],
      },
    });

    const issuesAndFailures = {
      failedFinancialTransactions,
      unhandledWebhooks,
      pendingReturns,
      totalIssues:
        failedFinancialTransactions + unhandledWebhooks + pendingReturns,
      hasCriticalIssues:
        failedFinancialTransactions + unhandledWebhooks + pendingReturns > 0,
    };

    return {
      success: true,
      data: {
        platformOverview,
        approvalsCenter,
        financialHealth,
        issuesAndFailures,
      },
    };
  }
}
