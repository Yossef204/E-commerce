import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SellerPayoutService } from './seller-payout.service';
import { CreatePayoutMethodDto } from './dto/create-payout-method.dto';
import { RequestSellerPayoutDto } from './dto/request-seller-payout.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['seller', 'api/seller'])
export class SellerPayoutController {
  constructor(private readonly sellerPayoutService: SellerPayoutService) {}

  private async getEntityId(req: any, queryEntityId?: string, bodyEntityId?: string) {
    const rawEntityId =
      queryEntityId ||
      bodyEntityId ||
      req.user?.sellingEntityId ||
      req.headers['x-selling-entity-id'];
    const ownerId = req.user?.sub || req.user?.id;
    return this.sellerPayoutService.resolveSellingEntityId(rawEntityId, ownerId);
  }

  /**
   * POST /seller/payout-methods
   * Add a new payout method
   */
  @UseGuards(AuthenticationGuard)
  @Post('payout-methods')
  @HttpCode(HttpStatus.CREATED)
  async addPayoutMethod(
    @Req() req: any,
    @Body() dto: CreatePayoutMethodDto,
  ) {
    const entityId = await this.getEntityId(req, undefined, dto.sellingEntityId);
    const data = await this.sellerPayoutService.addPayoutMethod(entityId, dto);
    return {
      success: true,
      message: 'تم إضافة وسيلة سحب الأرباح بنجاح',
      data,
    };
  }

  /**
   * GET /seller/payout-methods
   * Get all registered payout methods
   */
  @UseGuards(AuthenticationGuard)
  @Get('payout-methods')
  async getPayoutMethods(
    @Req() req: any,
    @Query('sellingEntityId') queryEntityId?: string,
  ) {
    const entityId = await this.getEntityId(req, queryEntityId);
    const data = await this.sellerPayoutService.getPayoutMethods(entityId);
    return {
      success: true,
      data,
    };
  }

  /**
   * PATCH /seller/payout-methods/:id/default
   * Set payout method as default
   */
  @UseGuards(AuthenticationGuard)
  @Patch('payout-methods/:id/default')
  async setDefaultPayoutMethod(
    @Req() req: any,
    @Param('id') methodId: string,
    @Query('sellingEntityId') queryEntityId?: string,
  ) {
    const entityId = await this.getEntityId(req, queryEntityId);
    const data = await this.sellerPayoutService.setDefaultPayoutMethod(
      entityId,
      methodId,
    );
    return {
      success: true,
      message: 'تم تعيين وسيلة السحب كوسيلة افتراضية',
      data,
    };
  }

  /**
   * GET /seller/wallet/balance
   * Return financial summary: pendingBalance, availableBalance, withdrawnBalance
   */
  @UseGuards(AuthenticationGuard)
  @Get('wallet/balance')
  async getWalletBalance(
    @Req() req: any,
    @Query('sellingEntityId') queryEntityId?: string,
  ) {
    const entityId = await this.getEntityId(req, queryEntityId);
    const data = await this.sellerPayoutService.getWalletBalance(entityId);
    return {
      success: true,
      data,
    };
  }

  /**
   * GET /seller/wallet/ledger
   * Return paginated immutable ledger entries
   */
  @UseGuards(AuthenticationGuard)
  @Get('wallet/ledger')
  async getLedger(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('sellingEntityId') queryEntityId?: string,
  ) {
    const entityId = await this.getEntityId(req, queryEntityId);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const data = await this.sellerPayoutService.getLedger(
      entityId,
      pageNum,
      limitNum,
      status,
    );
    return {
      success: true,
      ...data,
    };
  }

  /**
   * POST /seller/payouts/request
   * Submit payout request
   */
  @UseGuards(AuthenticationGuard)
  @Post('payouts/request')
  @HttpCode(HttpStatus.OK)
  async requestPayout(
    @Req() req: any,
    @Body() dto: RequestSellerPayoutDto,
  ) {
    const entityId = await this.getEntityId(req, undefined, dto.sellingEntityId);
    return this.sellerPayoutService.requestPayout(entityId, dto);
  }

  /**
   * GET /seller/payouts
   * Get payout requests history
   */
  @UseGuards(AuthenticationGuard)
  @Get('payouts')
  async getPayoutHistory(
    @Req() req: any,
    @Query('sellingEntityId') queryEntityId?: string,
  ) {
    const entityId = await this.getEntityId(req, queryEntityId);
    const data = await this.sellerPayoutService.getPayoutHistory(entityId);
    return {
      success: true,
      data,
    };
  }
}

