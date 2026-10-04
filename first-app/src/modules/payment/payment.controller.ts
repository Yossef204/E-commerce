import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ReleaseEscrowDto } from './dto/release-escrow.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { ProcessPayoutDto } from './dto/process-payout.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ORDERS_CREATE)
  @Post('process')
  public async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Request() req: any,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.body.customerId;
    return this.paymentService.processPayment(dto, customerId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ESCROW_MANAGE)
  @Post('escrow/release')
  public async releaseEscrow(@Body() dto: ReleaseEscrowDto) {
    return this.paymentService.releaseEscrow(dto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PAYOUT_REQUEST)
  @Post('payout')
  public async requestPayout(
    @Body() dto: RequestPayoutDto & ProcessPayoutDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub || req.body.userId;
    if (dto.amount && Number(dto.amount) > 0) {
      return this.paymentService.requestPayout(userId, dto);
    }
    return this.paymentService.processVendorPayout(dto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ANALYTICS_READ_OWN)
  @Get('summary/:sellingEntityId')
  public async getSellerFinancialSummary(
    @Param('sellingEntityId') sellingEntityId: string,
  ) {
    return this.paymentService.getSellerFinancialSummary(sellingEntityId);
  }
}
