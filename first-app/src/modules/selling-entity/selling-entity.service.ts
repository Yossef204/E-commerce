import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../models/user/user.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import { PayoutRepo } from '../../models/payout/payout.repository';
import { SellingEntityFactory } from './factory/selling-entity.factory';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateIndependentSellerDto } from './dto/create-independent-seller.dto';
import { UpdateEntityStatusDto } from './dto/update-entity-status.dto';
import { RolesEnum } from '../../common/enums/roles';
import { EntityStatusEnum } from '../../common/enums/entity-status.enum';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';

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
  ) {}

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

    const entityData = this.sellingEntityFactory.createCompanyEntity(
      ownerId,
      createCompanyDto,
    );
    const createdEntity = await this.sellingEntityRepo.create(entityData);

    await this.userRepo.updateOne(
      { _id: ownerId },
      { role: RolesEnum.COMPANY_ADMIN },
    );

    return {
      message: 'Company registered successfully. Pending super admin approval.',
      data: createdEntity,
    };
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

    const updatedEntity = await this.sellingEntityRepo.updateOne(
      { _id: entityId },
      {
        status: updateStatusDto.status,
        rejectionReason:
          updateStatusDto.status === EntityStatusEnum.REJECTED
            ? updateStatusDto.rejectionReason || 'No reason specified'
            : undefined,
      },
    );

    return {
      message: `Selling entity status updated to ${updateStatusDto.status}`,
      data: updatedEntity,
    };
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

    return {
      success: true,
      data: entity,
    };
  }

  async findAll() {
    const entities = await this.sellingEntityRepo.getAll({});
    return {
      success: true,
      data: entities,
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

    const escrows = await this.escrowRepo.getAll({ sellingEntityId });
    let escrowBalance = 0;
    let availablePayoutBalance = 0;

    for (const e of escrows) {
      if (e.status === EscrowStatusEnum.HELD) {
        escrowBalance += e.netAmount;
      } else if (e.status === EscrowStatusEnum.RELEASED) {
        availablePayoutBalance += e.netAmount;
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
}
