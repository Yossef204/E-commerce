import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ReviewRepo } from '../../models/review/review.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly reviewRepo: ReviewRepo,
    private readonly productRepo: ProductRepo,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly entityOrderRepo: EntityOrderRepo,
  ) {}

  /**
   * Check if a customer is eligible to write a verified review for a product
   */
  async checkEligibility(customerIdStr: string, productIdStr: string) {
    if (!Types.ObjectId.isValid(customerIdStr) || !Types.ObjectId.isValid(productIdStr)) {
      return { canReview: false, hasReviewed: false };
    }
    const customerId = new Types.ObjectId(customerIdStr);
    const productId = new Types.ObjectId(productIdStr);

    // 1. Check if user already reviewed this product
    const existingReview = await this.reviewRepo.getOne({
      customerId,
      productId,
    });
    if (existingReview) {
      return {
        canReview: false,
        hasReviewed: true,
        existingReview,
      };
    }

    // 2. Check if customer has a DELIVERED order containing this product
    const eligibleOrder = await this.findDeliveredOrderWithProduct(customerId, productId);
    if (!eligibleOrder) {
      return {
        canReview: false,
        hasReviewed: false,
        reason: 'لم يتم العثور على طلب مستلم يحتوي على هذا المنتج في حسابك',
      };
    }

    return {
      canReview: true,
      hasReviewed: false,
      orderId: eligibleOrder.mainOrderId.toString(),
    };
  }

  /**
   * Create a verified purchase review
   */
  async createReview(customerIdStr: string, dto: CreateReviewDto) {
    if (!Types.ObjectId.isValid(customerIdStr)) {
      throw new BadRequestException('معرف المستخدم غير صالح');
    }
    const customerId = new Types.ObjectId(customerIdStr);

    if (!Types.ObjectId.isValid(dto.productId)) {
      throw new BadRequestException('معرف المنتج غير صالح');
    }
    const productId = new Types.ObjectId(dto.productId);

    const product = await this.productRepo.getOne({ _id: productId });
    if (!product) {
      throw new NotFoundException('المنتج المطلوب تقييمه غير موجود');
    }

    // 1. Verify eligibility (Delivered order + No duplicate)
    const eligibility = await this.checkEligibility(customerIdStr, dto.productId);
    if (eligibility.hasReviewed) {
      throw new ConflictException('لقد قمت بتقييم هذا المنتج مسبقاً');
    }

    if (!eligibility.canReview) {
      throw new ForbiddenException(
        'لا يمكنك إضافة تقييم إلا بعد شراء المنتج واستلامه بنجاح (Verified Purchase)',
      );
    }

    const orderId = eligibility.orderId
      ? new Types.ObjectId(eligibility.orderId)
      : dto.orderId && Types.ObjectId.isValid(dto.orderId)
      ? new Types.ObjectId(dto.orderId)
      : new Types.ObjectId();

    // 2. Persist Review document
    const createdReview = await this.reviewRepo.create({
      productId,
      customerId,
      orderId,
      rating: dto.rating,
      comment: dto.comment.trim(),
      isVerifiedPurchase: true,
    });

    // 3. Compute new rating statistics via MongoDB aggregation
    await this.recalculateProductRatings(productId);

    return {
      success: true,
      message: 'تم إضافة تقييمك كمشترٍ موثق بنجاح، شكراً لمشاركتك!',
      review: createdReview,
    };
  }

  /**
   * Get paginated reviews for a product along with rating breakdown
   */
  async getProductReviews(productIdStr: string, page: number = 1, limit: number = 10) {
    if (!Types.ObjectId.isValid(productIdStr)) {
      throw new BadRequestException('معرف المنتج غير صالح');
    }
    const productId = new Types.ObjectId(productIdStr);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [reviews, total, breakdown] = await Promise.all([
      this.reviewRepo.model
        .find({ productId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('customerId', 'name avatar')
        .lean()
        .exec(),
      this.reviewRepo.model.countDocuments({ productId }),
      this.reviewRepo.model.aggregate([
        { $match: { productId } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Format breakdown into counts for 1..5 stars
    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const b of breakdown) {
      if (b._id && ratingCounts[b._id] !== undefined) {
        ratingCounts[b._id] = b.count;
      }
    }

    return {
      reviews,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
      ratingCounts,
    };
  }

  /**
   * Helper: Find delivered order for customer containing product
   */
  private async findDeliveredOrderWithProduct(customerId: Types.ObjectId, productId: Types.ObjectId) {
    // 1. Fetch customer's main orders
    const mainOrders = await this.mainOrderRepo.getAll({ customerId });
    if (!mainOrders || mainOrders.length === 0) return null;

    const mainOrderIds = mainOrders.map((o) => o._id);

    // 2. Fetch delivered entity orders
    const deliveredEntityOrders = await this.entityOrderRepo.getAll({
      mainOrderId: { $in: mainOrderIds },
      status: EntityOrderStatusEnum.DELIVERED,
    });

    // 3. Find if any item matches the productId
    for (const eo of deliveredEntityOrders) {
      const hasProduct = eo.items?.some(
        (it: any) =>
          it.productId?.toString() === productId.toString() ||
          (it as any).product?.toString() === productId.toString(),
      );
      if (hasProduct) {
        return eo;
      }
    }

    return null;
  }

  /**
   * Helper: Recalculate average and quantity on the Product model
   */
  private async recalculateProductRatings(productId: Types.ObjectId) {
    const stats = await this.reviewRepo.model.aggregate([
      { $match: { productId } },
      {
        $group: {
          _id: '$productId',
          ratingsQuantity: { $sum: 1 },
          ratingsAverage: { $avg: '$rating' },
        },
      },
    ]);

    if (stats.length > 0) {
      const avg = Math.round(stats[0].ratingsAverage * 10) / 10;
      const qty = stats[0].ratingsQuantity;
      await this.productRepo.model.updateOne(
        { _id: productId },
        {
          $set: {
            ratingsAverage: avg,
            ratingsQuantity: qty,
          },
        },
      );
    } else {
      await this.productRepo.model.updateOne(
        { _id: productId },
        {
          $set: {
            ratingsAverage: 0,
            ratingsQuantity: 0,
          },
        },
      );
    }
  }
}

