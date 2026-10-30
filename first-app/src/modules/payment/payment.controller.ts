import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ReleaseEscrowDto } from './dto/release-escrow.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { ProcessPayoutDto } from './dto/process-payout.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { RolesEnum } from '../../common/enums/roles';

@ApiTags('Admin Finance & Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_CREATE)
  @Post('process')
  @ApiOperation({
    summary: 'Process online payment',
    description: 'Executes customer payment transaction with gateway integration',
  })
  @ApiResponse({ status: 200, description: 'Payment processed' })
  public async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Request() req: any,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.body.customerId;
    return this.paymentService.processPayment(dto, customerId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ESCROW_MANAGE)
  @Get('escrow')
  @ApiOperation({
    summary: 'Get all escrow holdings',
    description: 'Retrieves current active, held, and released escrow funds across all vendor orders',
  })
  @ApiResponse({ status: 200, description: 'Escrows list returned' })
  public async getEscrows() {
    return this.paymentService.getAllEscrows();
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ESCROW_MANAGE)
  @Post('escrow/release')
  @ApiOperation({
    summary: 'Release escrow funds to vendor',
    description: 'Releases held escrow funds to seller wallet balance upon delivery confirmation',
  })
  @ApiResponse({ status: 200, description: 'Escrow released successfully' })
  public async releaseEscrow(@Body() dto: ReleaseEscrowDto) {
    return this.paymentService.releaseEscrow(dto);
  }

  /**
   * Vendor Payout Request (Vendor-only endpoint)
   */
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PAYOUT_REQUEST)
  @Post('payout')
  @ApiOperation({
    summary: 'Submit vendor payout request',
    description: 'Submits a withdrawal request against seller wallet balance',
  })
  @ApiResponse({ status: 200, description: 'Payout request submitted' })
  public async requestPayout(
    @Body() dto: RequestPayoutDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub || req.body?.userId;
    return this.paymentService.requestPayout(userId, dto);
  }

  /**
   * Admin Payout Execution (Admin-only endpoint)
   */
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PAYOUT_PROCESS)
  @Post('payout/execute')
  @ApiOperation({
    summary: 'Execute vendor payout disbursement (Admin only)',
    description: 'Admin execution of verified payout transfer to seller bank account',
  })
  @ApiResponse({ status: 200, description: 'Payout disbursed successfully' })
  public async executePayout(@Body() dto: ProcessPayoutDto) {
    return this.paymentService.processVendorPayout(dto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ANALYTICS_READ_OWN)
  @Get('summary/:sellingEntityId')
  @ApiOperation({
    summary: 'Get vendor financial summary',
    description: 'Returns gross revenue, net payout, and pending escrow totals',
  })
  @ApiParam({ name: 'sellingEntityId', description: 'Vendor entity ID' })
  @ApiResponse({ status: 200, description: 'Financial summary returned' })
  public async getSellerFinancialSummary(
    @Param('sellingEntityId') sellingEntityId: string,
    @Request() req?: any,
  ) {
    if (req?.user) {
      const role = (req.user.role || '').toLowerCase();
      const isSuperAdmin =
        role === 'admin' ||
        role === 'super_admin' ||
        role === RolesEnum.SUPER_ADMIN.toLowerCase();
      if (!isSuperAdmin && req.user.sellingEntityId && req.user.sellingEntityId.toString() !== sellingEntityId) {
        throw new ForbiddenException('غير مصرح لك باستعراض الملخص المالي لمتجر آخر');
      }
    }
    return this.paymentService.getSellerFinancialSummary(sellingEntityId);
  }
}
