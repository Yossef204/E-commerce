import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../models/user/user.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import { PayoutRepo } from '../../models/payout/payout.repository';
import { BrandRepo } from '../../models/brand/brand.repository';
import { PermissionRepo } from '../../models/permission/permission.repository';
import { SellingEntityFactory } from './factory/selling-entity.factory';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateIndependentSellerDto } from './dto/create-independent-seller.dto';
import { UpdateEntityStatusDto } from './dto/update-entity-status.dto';
import { RolesEnum } from '../../common/enums/roles';
import { AccountStatusEnum } from '../../common/enums/account-status';
import { EntityStatusEnum } from '../../common/enums/entity-status.enum';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';
import {
  parseAndValidateTokenVersion,
  syncTokenVersionToCache,
} from '../../common/utils/token-version.util';
import {
  DEFAULT_COMPANY_ADMIN_PERMISSIONS,
  DEFAULT_SELLER_PERMISSIONS,
} from '../../common/enums/default-role-permissions';
import { runSafeTransaction } from '../../common/utils/transaction.util';
import {
  CACHE_SERVICE,
  ICacheService,
} from '../../shared/cache/interfaces/cache-service.interface';

@Injectable()
export class SellingEntityService {
  constructor(
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly userRepo: UserRepo,
    private readonly productRepo: ProductRepo,
    private readonly entityOrderRepo: EntityOrderRepo,
    private readonly escrowRepo: EscrowRepo,
    private readonly payoutRepo: PayoutRepo,
    private readonly sellingEntityFactory: SellingEntityFactory,
    private readonly permissionRepo: PermissionRepo,
    private readonly brandRepo: BrandRepo,
    @InjectConnection() private readonly connection: Connection,
    @Optional() @Inject(CACHE_SERVICE) private readonly cacheService?: ICacheService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  async invalidateEntityCache(entityId: string | Types.ObjectId): Promise<void> {
    if (!entityId) return;
    const key = `entity:status:${entityId.toString()}`;
    try {
      if (this.cacheService) {
        await this.cacheService.del(key);
      }
      if (this.cacheManager) {
        await this.cacheManager.del(key);
      }
    } catch {
      // non-blocking
    }
  }

  async invalidateTokenVersion(
    userId: string | Types.ObjectId,
  ): Promise<void> {
    if (!userId) return;
    const userIdStr = userId.toString();

    try {
      let authoritativeVersion = 1;

      // 1. Atomically increment tokenVersion in authoritative MongoDB User document first
      if (this.userRepo && Types.ObjectId.isValid(userIdStr)) {
        const updatedUser = await this.userRepo.updateOne(
          { _id: new Types.ObjectId(userIdStr) },
          { $inc: { tokenVersion: 1 } },
          { new: true },
        );
        if (updatedUser && (updatedUser as any).tokenVersion !== undefined) {
          authoritativeVersion = parseAndValidateTokenVersion((updatedUser as any).tokenVersion);
        } else {
          const u = await this.userRepo.getOne({ _id: new Types.ObjectId(userIdStr) });
          authoritativeVersion = parseAndValidateTokenVersion((u as any)?.tokenVersion);
        }
      }

      // 2. Synchronize single canonical version across cache layers
      const cacheTarget = this.cacheService || this.cacheManager;
      if (cacheTarget) {
        await syncTokenVersionToCache(cacheTarget, userIdStr, authoritativeVersion);
      }
    } catch {
      // non-blocking
    }
  }

  async registerCompany(
    ownerIdStr: string,
    createCompanyDto: CreateCompanyDto,
  ) {
    if (!Types.ObjectId.isValid(ownerIdStr)) {
      throw new BadRequestException('Invalid owner ID format');
    }
    const ownerId = new Types.ObjectId(ownerIdStr);

    const user = await this.userRepo.getOne({ _id: ownerId });
    if (!user) {
      throw new NotFoundException('Owner user not found');
    }

    const existingEntity = await this.sellingEntityRepo.getOne({
      primaryOwnerId: ownerId,
    });
    if (existingEntity) {
      throw new ConflictException(
        'User already owns a registered selling entity',
      );
    }

    return await runSafeTransaction(this.connection, async (session) => {
      const options = session ? { session } : undefined;
      const entityData = this.sellingEntityFactory.createCompanyEntity(
        ownerId,
        createCompanyDto,
      );
      const createdEntity = await this.sellingEntityRepo.create(entityData, options);

      await this.userRepo.updateOne(
        { _id: ownerId },
        {
          role: RolesEnum.COMPANY_ADMIN,
          sellingEntityId: createdEntity._id,
        },
        options,
      );

      const brandSlug =
        createCompanyDto.legalName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') || `brand-${Date.now()}`;

      await this.brandRepo.create(
        {
          name: createCompanyDto.legalName,
          slug: brandSlug,
          sellingEntityId: createdEntity._id,
          isActive: false,
        } as any,
        options,
      );

      await this.permissionRepo.upsertUserPermissions(
        ownerIdStr,
        DEFAULT_COMPANY_ADMIN_PERMISSIONS,
      );

      return {
        message: 'Company registered successfully. Pending super admin approval.',
        data: createdEntity,
      };
    });
  }

  async registerIndependentSeller(
    ownerIdStr: string,
    createIndependentSellerDto: CreateIndependentSellerDto,
  ) {
    if (!Types.ObjectId.isValid(ownerIdStr)) {
      throw new BadRequestException('Invalid owner ID format');
    }
    const ownerId = new Types.ObjectId(ownerIdStr);

    const user = await this.userRepo.getOne({ _id: ownerId });
    if (!user) {
      throw new NotFoundException('Owner user not found');
    }

    const existingEntity = await this.sellingEntityRepo.getOne({
      primaryOwnerId: ownerId,
    });
    if (existingEntity) {
      throw new ConflictException(
        'User already owns a registered selling entity',
      );
    }

    const entityData = this.sellingEntityFactory.createIndependentSellerEntity(
      ownerId,
      createIndependentSellerDto,
    );
    const createdEntity = await this.sellingEntityRepo.create(entityData);

    await this.userRepo.updateOne({ _id: ownerId }, { role: RolesEnum.SELLER });

    await this.permissionRepo.upsertUserPermissions(
      ownerIdStr,
      DEFAULT_SELLER_PERMISSIONS,
    );

    return {
      message: 'Independent seller registered successfully.',
      data: createdEntity,
    };
  }

  async updateStatus(
    entityIdStr: string,
    updateStatusDto: UpdateEntityStatusDto,
  ) {
    if (!Types.ObjectId.isValid(entityIdStr)) {
      throw new BadRequestException('Invalid entity ID format');
    }
    const entityId = new Types.ObjectId(entityIdStr);

    const entity = await this.sellingEntityRepo.getOne({ _id: entityId });
    if (!entity) {
      throw new NotFoundException('Selling entity not found');
    }

    return await runSafeTransaction(this.connection, async (session) => {
      const options = session ? { session } : undefined;
      const updatedEntity = await this.sellingEntityRepo.updateOne(
        { _id: entityId },
        {
          status: updateStatusDto.status,
          rejectionReason:
            updateStatusDto.status === EntityStatusEnum.REJECTED
              ? updateStatusDto.rejectionReason || 'No reason specified'
              : undefined,
        },
        options,
      );

      const isApprovedOrActive =
        updateStatusDto.status === EntityStatusEnum.ACTIVE ||
        updateStatusDto.status === EntityStatusEnum.APPROVED;

      if (isApprovedOrActive) {
        if (entity.primaryOwnerId) {
          await this.userRepo.updateOne(
            { _id: entity.primaryOwnerId },
            { status: AccountStatusEnum.ACTIVE },
            options,
          );
        }

        await this.brandRepo.updateMany(
          { sellingEntityId: entityId },
          { isActive: true },
          options,
        );
      } else if (
        updateStatusDto.status === EntityStatusEnum.REJECTED ||
        updateStatusDto.status === EntityStatusEnum.DEACTIVATED
      ) {
        await this.brandRepo.updateMany(
          { sellingEntityId: entityId },
          { isActive: false },
          options,
        );
      }

      // 1. Invalidate entity status cache
      await this.invalidateEntityCache(entityId);

      // 2. Invalidate tokenVersion for primary owner and all associated users
      const associatedUsers: (Types.ObjectId | string)[] = [];
      if (entity.primaryOwnerId) {
        associatedUsers.push(entity.primaryOwnerId);
      }
      try {
        const users = await this.userRepo.getAll({ sellingEntityId: entityId } as any);
        for (const u of users) {
          if (u._id && !associatedUsers.some((id) => id.toString() === u._id!.toString())) {
            associatedUsers.push(u._id);
          }
        }
      } catch {
        // non-blocking
      }

      for (const uid of associatedUsers) {
        await this.invalidateTokenVersion(uid);
      }

      const doc = (updatedEntity as any)?.toObject ? (updatedEntity as any).toObject() : updatedEntity;
      const normalizedEntity = {
        ...doc,
        tradeName: doc?.legalName || doc?.tradeName || 'غير محدد',
        companyLegalName: doc?.legalName,
        commercialRegisterNumber: doc?.businessDetails?.commercialRegister || doc?.commercialRegisterNumber,
        taxCardNumber: doc?.businessDetails?.taxNumber || doc?.taxCardNumber,
        sellerFullName: doc?.legalName,
        nationalIdNumber: doc?.businessDetails?.taxNumber || doc?.businessDetails?.commercialRegister,
      };

      return {
        message: `Selling entity status updated to ${updateStatusDto.status}`,
        data: normalizedEntity,
      };
    });
  }

  async getProfile(ownerIdStr: string) {
    if (!Types.ObjectId.isValid(ownerIdStr)) {
      throw new BadRequestException('Invalid owner ID format');
    }
    const ownerId = new Types.ObjectId(ownerIdStr);

    const entity = await this.sellingEntityRepo.getOne({
      primaryOwnerId: ownerId,
    });
    if (!entity) {
      throw new NotFoundException(
        'No selling entity profile found for this user',
      );
    }

    let brand = await this.brandRepo.getOne({
      sellingEntityId: entity._id,
    });

    if (!brand) {
      const brandName = entity.legalName || 'Default Brand';
      const brandSlug =
        brandName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') || `brand-${Date.now()}`;
      try {
        brand = await this.brandRepo.create({
          name: brandName,
          slug: `${brandSlug}-${entity._id}`,
          sellingEntityId: entity._id,
          isActive: entity.status === EntityStatusEnum.ACTIVE || entity.status === EntityStatusEnum.APPROVED,
        } as any);
      } catch (e) {
        brand = await this.brandRepo.getOne({
          sellingEntityId: entity._id,
        });
      }
    }

    const entityDoc = (entity as any)?.toObject ? (entity as any).toObject() : entity;

    return {
      success: true,
      data: {
        ...entityDoc,
        brand,
      },
    };
  }

  async findAll() {
    const entities = await this.sellingEntityRepo.getAll({});
    const normalizedEntities = entities.map((entity: any) => {
      const doc = entity.toObject ? entity.toObject() : entity;
      return {
        ...doc,
        tradeName: doc.legalName || doc.tradeName || 'غير محدد',
        companyLegalName: doc.legalName,
        commercialRegisterNumber: doc.businessDetails?.commercialRegister || doc.commercialRegisterNumber,
        taxCardNumber: doc.businessDetails?.taxNumber || doc.taxCardNumber,
        sellerFullName: doc.legalName,
        nationalIdNumber: doc.businessDetails?.taxNumber || doc.businessDetails?.commercialRegister,
      };
    });

    return {
      success: true,
      data: normalizedEntities,
    };
  }

  async getDashboardMetrics(sellingEntityIdStr: string) {
    if (!Types.ObjectId.isValid(sellingEntityIdStr)) {
      throw new BadRequestException('Invalid selling entity ID format');
    }
    const sellingEntityId = new Types.ObjectId(sellingEntityIdStr);

    const entity = await this.sellingEntityRepo.getOne({
      _id: sellingEntityId,
    });
    if (!entity) {
      throw new NotFoundException('Selling entity not found');
    }

    const allProducts = await this.productRepo.getAll({ sellingEntityId });
    const activeProductsCount = allProducts.filter(
      (p) => p.approvalStatus === ProductApprovalStatusEnum.APPROVED,
    ).length;

    const allEntityOrders = await this.entityOrderRepo.getAll({
      sellingEntityId,
    });
    const sortedOrders = [...allEntityOrders].sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );
    const recentOrders = sortedOrders.slice(0, 5);

    const totalSales = allEntityOrders.reduce(
      (sum, o) => sum + (o.subtotal || 0),
      0,
    );
    const pendingOrdersCount = allEntityOrders.filter(
      (o) =>
        o.status === EntityOrderStatusEnum.PENDING ||
        o.status === EntityOrderStatusEnum.PROCESSING ||
        o.status === EntityOrderStatusEnum.CONFIRMED,
    ).length;

    let escrowBalance = 0;
    let availablePayoutBalance = 0;

    const ledgerModel = this.connection.models['LedgerEntry'];
    if (ledgerModel) {
      const [ledgerAgg] = await ledgerModel.aggregate([
        { $match: { sellingEntityId } },
        {
          $group: {
            _id: null,
            availableOrderCredit: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$entryType', 'ORDER_CREDIT'] },
                      { $eq: ['$status', 'AVAILABLE'] },
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
                      { $eq: ['$entryType', 'ORDER_CREDIT'] },
                      { $eq: ['$status', 'HELD_ESCROW'] },
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
                  { $eq: ['$entryType', 'REFUND_DEBIT'] },
                  { $abs: '$amount' },
                  0,
                ],
              },
            },
            payoutDebit: {
              $sum: {
                $cond: [
                  { $eq: ['$entryType', 'PAYOUT_DEBIT'] },
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
                      { $eq: ['$entryType', 'PLATFORM_FEE_DEBIT'] },
                      {
                        $or: [
                          { $eq: ['$paymentMethod', 'COD'] },
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

      const availableCredit = ledgerAgg?.availableOrderCredit || 0;
      escrowBalance = ledgerAgg?.heldEscrowBalance || 0;
      const refundDebit = ledgerAgg?.refundDebit || 0;
      const payoutDebit = ledgerAgg?.payoutDebit || 0;
      const codDues = ledgerAgg?.codDues || 0;

      const netCredit = availableCredit - refundDebit - payoutDebit;
      availablePayoutBalance = netCredit >= codDues ? netCredit - codDues : 0;
    }

    if (escrowBalance === 0 && availablePayoutBalance === 0) {
      const escrows = await this.escrowRepo.getAll({ sellingEntityId });
      for (const e of escrows) {
        if (e.status === EscrowStatusEnum.HELD) {
          escrowBalance += e.netAmount;
        } else if (e.status === EscrowStatusEnum.RELEASED) {
          availablePayoutBalance += e.netAmount;
        }
      }
    }

    return {
      success: true,
      data: {
        entity,
        metrics: {
          totalSales: Math.round(totalSales * 100) / 100,
          pendingOrdersCount,
          activeProductsCount,
          escrowBalance: Math.round(escrowBalance * 100) / 100,
          availablePayoutBalance:
            Math.round(availablePayoutBalance * 100) / 100,
        },
        recentOrders,
      },
    };
  }

  async getEntityStatus(ownerIdStr: string) {
    if (!Types.ObjectId.isValid(ownerIdStr)) {
      throw new BadRequestException('Invalid owner ID format');
    }
    const ownerId = new Types.ObjectId(ownerIdStr);
    let entity = await this.sellingEntityRepo.getOne({
      primaryOwnerId: ownerId,
    });
    if (!entity) {
      const user = await this.userRepo.getOne({ _id: ownerId });
      if (user?.sellingEntityId) {
        entity = await this.sellingEntityRepo.getOne({
          _id: user.sellingEntityId,
        });
      }
    }
    if (!entity) {
      throw new NotFoundException('No selling entity found for this merchant');
    }

    const doc = (entity as any)?.toObject ? (entity as any).toObject() : entity;
    return {
      success: true,
      data: {
        entityId: doc._id,
        status: doc.status,
        legalName: doc.legalName,
        tradeName: doc.tradeName,
        type: doc.type,
        rejectionReason: doc.rejectionReason,
      },
    };
  }

  async uploadOnboardingDocuments(
    ownerIdStr: string,
    body: { documentUrl?: string; taxOrCommercialNumber?: string },
  ) {
    if (!Types.ObjectId.isValid(ownerIdStr)) {
      throw new BadRequestException('Invalid owner ID format');
    }
    const ownerId = new Types.ObjectId(ownerIdStr);
    let entity = await this.sellingEntityRepo.getOne({
      primaryOwnerId: ownerId,
    });
    if (!entity) {
      const user = await this.userRepo.getOne({ _id: ownerId });
      if (user?.sellingEntityId) {
        entity = await this.sellingEntityRepo.getOne({
          _id: user.sellingEntityId,
        });
      }
    }
    if (!entity) {
      throw new NotFoundException('No selling entity found for this merchant');
    }

    const updatePayload: any = {};
    if (body.documentUrl) {
      updatePayload.documentUrl = body.documentUrl;
    }
    if (body.taxOrCommercialNumber) {
      updatePayload['businessDetails.taxNumber'] = body.taxOrCommercialNumber;
      updatePayload['businessDetails.commercialRegister'] = body.taxOrCommercialNumber;
    }

    const updated = await this.sellingEntityRepo.updateOne(
      { _id: entity._id },
      { $set: updatePayload },
    );

    return {
      success: true,
      message: 'تم تحديث وثائق التاجر بنجاح',
      data: updated,
    };
  }
}
