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
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateEntityOrderStatusDto } from './dto/update-entity-order-status.dto';
import { VerifyCodOtpDto } from './dto/verify-cod-otp.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentContext } from '../../shared/payment/context/payment.context';
import { CheckoutSagaService } from '../../shared/payment/saga/checkout.saga';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimiterGuard } from '../../common/guards/rate-limiter.guard';

@ApiTags('Orders')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['orders', 'api/orders'])
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentContext: PaymentContext,
    private readonly checkoutSagaService: CheckoutSagaService,
  ) {}

  @Public()
  @Get('payment-methods')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available payment methods',
    description: 'Returns enabled payment methods (COD, Stripe, Paymob, Wallet) based on platform config',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Available payment methods returned' })
  getPaymentMethods() {
    return {
      success: true,
      data: this.paymentContext.getAvailablePaymentMethods(),
    };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_CREATE)
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Order Checkout & Multi-Vendor Split',
    description:
      'Processes checkout, performs atomic stock reservation, splits cart into vendor EntityOrders, and triggers payment/COD flow',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: false,
    description: 'Unique UUID key to prevent duplicate checkout charges',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Order created and split successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Insufficient stock or invalid input' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Idempotency key collision or stock race' })
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

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_UPDATE_STATUS)
  @Patch('entity-orders/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Vendor Sub-Order Status',
    description:
      'Progressively transitions entity order status (CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED). Enforces vendor ownership scoping.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the EntityOrder' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order status updated successfully' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Vendor not permitted to update another vendor order' })
  async updateEntityOrderStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityOrderStatusDto,
    @Req() req: any,
    @Body('ownerId') ownerId?: string,
  ) {
    const userId = req.user?.id || req.user?.sub || req.user?._id || ownerId;
    return this.orderService.updateEntityOrderStatus(userId, id, updateDto, req.user);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_READ_OWN)
  @Get('my-orders')
  @ApiOperation({
    summary: 'Get current customer order history',
    description: 'Retrieves all orders placed by the authenticated customer',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Orders retrieved' })
  async getMyOrders(
    @Req() req: any,
    @Query('customerId') queryCustomerId?: string,
  ) {
    const authenticatedUserId = req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.getMyOrders(authenticatedUserId, queryCustomerId, req?.user);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_READ_OWN)
  @Get('my-orders/:customerId')
  @ApiOperation({
    summary: 'Get customer order history',
    description: 'Retrieves all orders placed by the customer with entity order status breakdown',
  })
  @ApiParam({ name: 'customerId', description: 'MongoDB ObjectId of customer' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Orders retrieved' })
  async getCustomerOrders(
    @Param('customerId') customerId: string,
    @Req() req: any,
  ) {
    return this.orderService.getCustomerOrders(customerId, req?.user);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_READ_ALL)
  @Get('admin/all')
  @ApiOperation({
    summary: 'Admin Global Order Oversight',
    description: 'Lists all main orders across all vendors with pagination, financial breakdown, and filter queries',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Global orders list retrieved' })
  async getAllOrdersForAdmin(@Req() req: any, @Query() query: any) {
    return this.orderService.getAllOrdersForAdmin(req?.user, query);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_READ_ENTITY)
  @Get('entity/:sellingEntityId')
  @ApiOperation({
    summary: 'Vendor Scoped Orders',
    description: 'Lists all entity sub-orders belonging exclusively to the authenticated seller commercial entity',
  })
  @ApiParam({ name: 'sellingEntityId', description: 'MongoDB ObjectId of selling entity' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Vendor orders list' })
  async getEntityOrders(
    @Param('sellingEntityId') sellingEntityId: string,
    @Query('ownerId') ownerId: string,
    @Req() req: any,
  ) {
    // Prioritize authenticated user ID over query parameter
    const effectiveOwnerId = req.user?.id || req.user?.sub || req.user?._id || ownerId;
    return this.orderService.getEntityOrders(effectiveOwnerId, sellingEntityId, req.user);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard, RateLimiterGuard)
  @permissions(Permission.ORDER_READ_OWN)
  @RateLimit({ limit: 5, ttlSeconds: 300, keyPrefix: 'verify_cod_otp', trackBy: 'order_id' })
  @Post(':id/verify-cod-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify COD Order OTP',
    description:
      'Validates 6-digit OTP stored in Redis. Enforces 5-attempt rate-limit per order. On success, transitions order to CONFIRMED.',
  })
  @ApiParam({ name: 'id', description: 'MainOrder ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'COD order confirmed and OTP cleared' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many failed verification attempts (max 5)' })
  async verifyCodOtp(
    @Param('id') id: string,
    @Body() dto: VerifyCodOtpDto,
    @Req() req: any,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.verifyCodOtp(customerId, id, dto.otp, req.user);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_READ_OWN)
  @Post(':id/resend-cod-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend COD OTP verification code',
    description: 'Generates new OTP, saves with fresh TTL in Redis, and dispatches via SMS/Mail',
  })
  @ApiParam({ name: 'id', description: 'MainOrder ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'New OTP dispatched' })
  async resendCodOtp(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.resendCodOtp(customerId, id, req.user);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_READ_OWN)
  @Get(':id')
  @ApiOperation({
    summary: 'Get single order by ID',
    description: 'Retrieves order details enforcing ownership scoping',
  })
  @ApiParam({ name: 'id', description: 'MainOrder MongoDB ObjectId' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order details retrieved' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found' })
  async getOrderById(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const authenticatedUserId = req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.getOrderById(id, authenticatedUserId, req?.user);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_CANCEL_OWN)
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel customer order',
    description: 'Allows customer to cancel their own unfulfilled order and release inventory stock',
  })
  @ApiParam({ name: 'id', description: 'MainOrder ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order cancelled successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found or access denied' })
  async cancelOrder(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.orderService.cancelMyOrder(id, customerId, req.user);
  }
}
