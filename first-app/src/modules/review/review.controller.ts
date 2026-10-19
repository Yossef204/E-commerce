import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Create verified purchase review
   */
  @UseGuards(AuthenticationGuard)
  @Post()
  async createReview(@Req() req: any, @Body() dto: CreateReviewDto) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.reviewService.createReview(customerId, dto);
  }

  /**
   * Check if current user is eligible to review product
   */
  @UseGuards(AuthenticationGuard)
  @Get('eligibility/:productId')
  async checkEligibility(
    @Req() req: any,
    @Param('productId') productId: string,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.reviewService.checkEligibility(customerId, productId);
  }

  /**
   * Get paginated reviews for a product
   */
  @Get('product/:productId')
  async getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.reviewService.getProductReviews(
      productId,
      Number(page),
      Number(limit),
    );
  }
}

