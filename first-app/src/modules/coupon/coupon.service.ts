import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CouponRepo } from '../../models/coupon/coupon.repository';
import { CouponUsageRepo } from '../../models/coupon/coupon-usage.repository';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { CreateVendorCouponDto } from './dto/create-vendor-coupon.dto';
import { CreatePlatformCouponDto } from './dto/create-platform-coupon.dto';
import { CartItemDto } from './dto/apply-coupon.dto';
import { CouponScopeEnum } from '../../common/enums/coupon-scope.enum';
import { DiscountTypeEnum } from '../../common/enums/discount-type.enum';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';

export interface AppliedCouponResult {
  coupon: any;
  couponId: string;
  code: string;
  scope: CouponScopeEnum;
  sellingEntityId: string | null;
  discountType: DiscountTypeEnum;
  discountValue: number;
  discountAmount: number;
  applicableSubtotal: number;
  originalTotalAmount: number;
  newTotalAmount: number;
}

@Injectable()
export class CouponService {
  constructor(
    private readonly couponRepo: CouponRepo,
    private readonly couponUsageRepo: CouponUsageRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly productRepo: ProductRepo,
  ) {}

  async createVendorCoupon(
    sellingEntityIdStr: string,
    dto: CreateVendorCouponDto,
  ) {
    if (!sellingEntityIdStr || !Types.ObjectId.isValid(sellingEntityIdStr)) {
      throw new ForbiddenException(
        'User does not belong to a valid selling entity',
      );
    }

    const code = dto.code.trim().toUpperCase();
    const existing = await this.couponRepo.getOne({ code });
    if (existing) {
      throw new ConflictException(
        `Coupon with code "${code}" already exists`,
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (
      dto.discountType === DiscountTypeEnum.PERCENTAGE &&
      (dto.discountValue <= 0 || dto.discountValue > 100)
    ) {
      throw new BadRequestException(
        'Percentage discount value must be between 1 and 100',
      );
    }

    return this.couponRepo.create({
      code,
      scope: CouponScopeEnum.VENDOR,
      sellingEntityId: new Types.ObjectId(sellingEntityIdStr),
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxDiscountAmount: dto.maxDiscountAmount || null,
      minOrderValue: dto.minOrderValue || 0,
      startDate,
      endDate,
      usageLimit: dto.usageLimit || 1000,
      usedCount: 0,
      usagePerUser: dto.usagePerUser || 1,
      isActive: true,
    });
  }

  async createPlatformCoupon(dto: CreatePlatformCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.couponRepo.getOne({ code });
    if (existing) {
      throw new ConflictException(
        `Coupon with code "${code}" already exists`,
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (
      dto.discountType === DiscountTypeEnum.PERCENTAGE &&
      (dto.discountValue <= 0 || dto.discountValue > 100)
    ) {
      throw new BadRequestException(
        'Percentage discount value must be between 1 and 100',
      );
    }

    return this.couponRepo.create({
      code,
      scope: CouponScopeEnum.PLATFORM,
      sellingEntityId: null,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxDiscountAmount: dto.maxDiscountAmount || null,
      minOrderValue: dto.minOrderValue || 0,
      startDate,
      endDate,
      usageLimit: dto.usageLimit || 1000,
      usedCount: 0,
      usagePerUser: dto.usagePerUser || 1,
      isActive: true,
    });
  }

  async getVendorCoupons(sellingEntityIdStr: string) {
    if (!sellingEntityIdStr || !Types.ObjectId.isValid(sellingEntityIdStr)) {
      throw new ForbiddenException(
        'User does not belong to a valid selling entity',
      );
    }
    return this.couponRepo.getAll({
      sellingEntityId: new Types.ObjectId(sellingEntityIdStr),
    });
  }

  async getAllCoupons() {
    return this.couponRepo.getAll({}, undefined, { sort: { createdAt: -1 } });
  }

  async updateCouponStatus(couponIdStr: string, isActive: boolean) {
    if (!couponIdStr || !Types.ObjectId.isValid(couponIdStr)) {
      throw new BadRequestException('Invalid coupon ID format');
    }
    const updated = await this.couponRepo.updateOne(
      { _id: new Types.ObjectId(couponIdStr) },
      { isActive },
    );
    if (!updated) {
      throw new NotFoundException('Coupon not found');
    }
    return updated;
  }

  async validateAndApplyCoupon(
    code: string,
    userIdStr: string,
    items: CartItemDto[],
  ): Promise<AppliedCouponResult> {
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }
    const normalizedCode = code.trim().toUpperCase();

    const coupon = await this.couponRepo.getOne({ code: normalizedCode });
    if (!coupon) {
      throw new NotFoundException(
        `Coupon code "${normalizedCode}" not found`,
      );
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is currently inactive');
    }

    const now = new Date();
    if (now < new Date(coupon.startDate)) {
      throw new BadRequestException('Coupon is not yet active');
    }
    if (now > new Date(coupon.endDate)) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException(
        'Coupon total usage limit has been reached',
      );
    }

    if (userIdStr && Types.ObjectId.isValid(userIdStr)) {
      const userUsageCount = await this.couponUsageRepo.countUserUsages(
        coupon._id,
        new Types.ObjectId(userIdStr),
      );
      if (coupon.usagePerUser && userUsageCount >= coupon.usagePerUser) {
        throw new BadRequestException(
          'You have reached the maximum allowed usages for this coupon',
        );
      }
    }

    if (!items || items.length === 0) {
      throw new BadRequestException(
        'Cart items cannot be empty to apply a coupon',
      );
    }

    // Resolve items prices and selling entities
    const resolvedItems: {
      sellingEntityId: Types.ObjectId;
      sku: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[] = [];

    for (const itemDto of items) {
      const inventory = await this.inventoryRepo.getOne({
        sku: itemDto.sku.trim(),
      });
      if (!inventory) {
        throw new NotFoundException(
          `Inventory record for SKU "${itemDto.sku}" not found`,
        );
      }

      const product = await this.productRepo.getOne({
        _id: inventory.productId,
      });
      if (
        !product ||
        product.approvalStatus !== ProductApprovalStatusEnum.APPROVED
      ) {
        throw new BadRequestException(
          `Product for SKU "${itemDto.sku}" is not approved or available`,
        );
      }

      const variant = product.variants.find(
        (v) => v.sku === itemDto.sku.trim(),
      );
      if (!variant || !variant.isActive) {
        throw new BadRequestException(
          `Variant for SKU "${itemDto.sku}" is inactive`,
        );
      }

      const unitPrice = variant.price;
      const totalPrice = unitPrice * itemDto.quantity;

      resolvedItems.push({
        sellingEntityId: product.sellingEntityId,
        sku: variant.sku,
        quantity: itemDto.quantity,
        unitPrice,
        totalPrice,
      });
    }

    const totalCartAmount = resolvedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    let applicableSubtotal = 0;

    if (coupon.scope === CouponScopeEnum.VENDOR) {
      if (!coupon.sellingEntityId) {
        throw new BadRequestException('Vendor coupon lacks sellingEntityId');
      }

      const matchingItems = resolvedItems.filter(
        (item) =>
          item.sellingEntityId.toString() ===
          coupon.sellingEntityId!.toString(),
      );

      if (matchingItems.length === 0) {
        throw new BadRequestException(
          'This coupon is valid only for products from the issuing vendor',
        );
      }

      const vendorSubtotal = matchingItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );

      if (coupon.minOrderValue && vendorSubtotal < coupon.minOrderValue) {
        throw new BadRequestException(
          `Minimum order value of $${coupon.minOrderValue} required for vendor items (Current: $${vendorSubtotal})`,
        );
      }

      applicableSubtotal = vendorSubtotal;
    } else {
      // PLATFORM scope
      if (coupon.minOrderValue && totalCartAmount < coupon.minOrderValue) {
        throw new BadRequestException(
          `Minimum order value of $${coupon.minOrderValue} required (Current cart: $${totalCartAmount})`,
        );
      }

      applicableSubtotal = totalCartAmount;
    }

    let discountAmount = 0;
    if (coupon.discountType === DiscountTypeEnum.PERCENTAGE) {
      discountAmount = applicableSubtotal * (coupon.discountValue / 100);
      if (
        coupon.maxDiscountAmount &&
        discountAmount > coupon.maxDiscountAmount
      ) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else if (coupon.discountType === DiscountTypeEnum.FIXED_AMOUNT) {
      discountAmount = Math.min(coupon.discountValue, applicableSubtotal);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const newTotalAmount = Math.max(0, totalCartAmount - discountAmount);

    return {
      coupon,
      couponId: coupon._id.toString(),
      code: coupon.code,
      scope: coupon.scope,
      sellingEntityId: coupon.sellingEntityId
        ? coupon.sellingEntityId.toString()
        : null,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      applicableSubtotal,
      originalTotalAmount: totalCartAmount,
      newTotalAmount,
    };
  }

  async recordCouponUsage(
    couponId: Types.ObjectId,
    userId: Types.ObjectId,
    orderId: Types.ObjectId,
    discountAmount: number,
    options?: any,
  ) {
    await this.couponRepo.incrementUsedCount(couponId, options);
    return this.couponUsageRepo.create(
      {
        couponId,
        userId,
        orderId,
        discountAmount,
      },
      options,
    );
  }
}
