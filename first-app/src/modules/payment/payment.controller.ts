import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ReleaseEscrowDto } from './dto/release-escrow.dto';
import { ProcessPayoutDto } from './dto/process-payout.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('process')
  public async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Request() req: any,
  ) {
    const customerId = req.user?.id || req.body.customerId;
    return this.paymentService.processPayment(dto, customerId);
  }

  @Post('escrow/release')
  public async releaseEscrow(@Body() dto: ReleaseEscrowDto) {
    return this.paymentService.releaseEscrow(dto);
  }

  @Post('payout')
  public async processVendorPayout(@Body() dto: ProcessPayoutDto) {
    return this.paymentService.processVendorPayout(dto);
  }

  @Get('summary/:sellingEntityId')
  public async getSellerFinancialSummary(
    @Param('sellingEntityId') sellingEntityId: string,
  ) {
    return this.paymentService.getSellerFinancialSummary(sellingEntityId);
  }
}
