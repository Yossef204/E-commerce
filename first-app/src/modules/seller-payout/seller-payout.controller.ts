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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SellerPayoutService } from './seller-payout.service';
import { CreatePayoutMethodDto } from './dto/create-payout-method.dto';
import { RequestSellerPayoutDto } from './dto/request-seller-payout.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@ApiTags('Seller Payout & Ledger')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['seller', 'api/seller', 'payouts', 'api/payouts'])
export class SellerPayoutController {
  constructor(private readonly sellerPayoutService: SellerPayoutService) {}

  private async getEntityId(req: any, queryEntityId?: string, bodyEntityId?: string) {
    const ownerId = req.user?.sub || req.user?.id;
    const requestedEntityId =
      req.user?.sellingEntityId ||
      queryEntityId ||
      bodyEntityId ||
      req.headers['x-selling-entity-id'];
    return this.sellerPayoutService.resolveSellingEntityId(requestedEntityId, ownerId, req.user);
  }

  /**
   * POST /seller/payout-methods
   * Add a new payout method
   */
  @Auditable({ targetEntity: 'SellerPayout', action: AuditActionEnum.CREATE })
  @permissions(Permission.PAYOUT_REQUEST)
  @Post('payout-methods')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add vendor payout method',
    description: 'Registers bank account, InstaPay, or mobile wallet for withdrawal destinations',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Payout method registered' })
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
  @permissions(Permission.PAYOUT_READ_OWN)
  @Get('payout-methods')
  @ApiOperation({
    summary: 'Get vendor payout methods',
    description: 'Lists all payout destination methods configured for the vendor',
  })
  @ApiQuery({ name: 'sellingEntityId', required: false, description: 'Optional entity override' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payout methods returned' })
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
  @permissions(Permission.PAYOUT_REQUEST)
  @Patch('payout-methods/:id/default')
  @ApiOperation({
    summary: 'Set default payout method',
    description: 'Marks selected payout method as primary for future payouts',
  })
  @ApiParam({ name: 'id', description: 'Payout method ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Default method updated' })
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
  @permissions(Permission.WALLET_READ_OWN)
  @Get('wallet/balance')
  @ApiOperation({
    summary: 'Get Seller Wallet Balance & Escrow Breakdown',
    description:
      'Calculates available balance, held escrow balance, and pending payouts from immutable double-entry ledger',
  })
  @ApiQuery({ name: 'sellingEntityId', required: false, description: 'Optional entity ID override' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Wallet balance breakdown returned' })
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
  @permissions(Permission.WALLET_READ_OWN)
  @Get('wallet/ledger')
  @ApiOperation({
    summary: 'Get Seller Immutable Ledger History',
    description:
      'Returns paginated audit trail of financial ledger movements (ORDER_PAYMENT_CREDIT, PLATFORM_FEE_DEBIT, REFUND_DEBIT, PAYOUT_DEBIT)',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page limit' })
  @ApiQuery({ name: 'status', required: false, description: 'LedgerEntryStatus filter' })
  @ApiQuery({ name: 'sellingEntityId', required: false, description: 'Optional entity override' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated ledger history returned' })
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
   * POST /seller/payouts/request or POST /payouts/request
   * Submit payout request
   */
  @Auditable({ targetEntity: 'SellerPayout', action: AuditActionEnum.PAYOUT_GENERATED })
  @permissions(Permission.PAYOUT_REQUEST)
  @Post(['payouts/request', 'request'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request Vendor Payout',
    description:
      'Submits payout withdrawal request against available balance. Enforces min threshold and prevents duplicate concurrent pending requests.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payout request created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Amount exceeds available balance or below minimum' })
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
  @permissions(Permission.PAYOUT_READ_OWN)
  @Get('payouts')
  @ApiOperation({
    summary: 'Get vendor payout requests history',
    description: 'Lists all past and pending payout requests with status and settlement details',
  })
  @ApiQuery({ name: 'sellingEntityId', required: false, description: 'Optional entity override' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payout requests list' })
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
