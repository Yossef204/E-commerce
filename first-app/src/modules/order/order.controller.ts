import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateEntityOrderStatusDto } from './dto/update-entity-order-status.dto';
import { VerifyCodOtpDto } from './dto/verify-cod-otp.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';
import { PaymentContext } from '../../shared/payment/context/payment.context';
import { CheckoutSagaService } from '../../shared/payment/saga/checkout.saga';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimiterGuard } from '../../common/guards/rate-limiter.guard';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['orders', 'api/orders'])
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentContext: PaymentContext,
    private readonly checkoutSagaService: CheckoutSagaService,
  ) {}

  @Get('payment-methods')
  @HttpCode(HttpStatus.OK)
  getPaymentMethods() {
    return {
      success: true,
      data: this.paymentContext.getAvailablePaymentMethods(),
    };
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ORDERS_CREATE)
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() checkoutDto: CheckoutDto,
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ) {
    if (!checkoutDto.idempotencyKey && idempotencyKeyHeader) {
      checkoutDto.idempotencyKey = idempotencyKeyHeader;
    }
    const customerId = req.user?.id || req.user?.sub || checkoutDto.customerId;

    return this.orderService.checkout(customerId, checkoutDto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ORDERS_STATUS_UPDATE)
  @Patch('entity-orders/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateEntityOrderStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityOrderStatusDto,
    @Req() req: any,
    @Body('ownerId') ownerId?: string,
  ) {
    const userId = req.user?.id || req.user?.sub || req.user?._id || ownerId;
    return this.orderService.updateEntityOrderStatus(userId, id, updateDto, req.user);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ORDERS_READ_OWN)
  @Get('my-orders/:customerId')
  async getCustomerOrders(@Param('customerId') customerId: string) {
    return this.orderService.getCustomerOrders(customerId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ORDERS_SELLER_READ)
  @Get('entity/:sellingEntityId')
  async getEntityOrders(
    @Param('sellingEntityId') sellingEntityId: string,
    @Query('ownerId') ownerId: string,
    @Req() req: any,
  ) {
    const effectiveOwnerId = ownerId || req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.getEntityOrders(effectiveOwnerId, sellingEntityId, req.user);
  }

  @UseGuards(AuthenticationGuard, RateLimiterGuard)
  @RateLimit({ limit: 5, ttlSeconds: 300, keyPrefix: 'verify_cod_otp', trackBy: 'order_id' })
  @Post(':id/verify-cod-otp')
  @HttpCode(HttpStatus.OK)
  async verifyCodOtp(
    @Param('id') id: string,
    @Body() dto: VerifyCodOtpDto,
    @Req() req: any,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.verifyCodOtp(customerId, id, dto.otp, req.user);
  }

  @UseGuards(AuthenticationGuard)
  @Post(':id/resend-cod-otp')
  @HttpCode(HttpStatus.OK)
  async resendCodOtp(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.resendCodOtp(customerId, id, req.user);
  }
}
