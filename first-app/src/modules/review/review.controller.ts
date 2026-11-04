import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { Public } from '../../common/decorators/public.decorator';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Create verified purchase review
   */
  @Auditable({ targetEntity: 'Review', action: AuditActionEnum.CREATE })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.REVIEW_CREATE)
  @Post()
  @ApiOperation({ summary: 'Submit product review for verified purchase' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Review submitted' })
  async createReview(@Req() req: any, @Body() dto: CreateReviewDto) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.reviewService.createReview(customerId, dto);
  }

  /**
   * Check if current user is eligible to review product
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.REVIEW_CREATE)
  @Get('eligibility/:productId')
  @ApiOperation({ summary: 'Check product review eligibility' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Eligibility status returned' })
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
  @Public()
  @Get('product/:productId')
  @ApiOperation({ summary: 'Get approved reviews for product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product reviews list' })
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
