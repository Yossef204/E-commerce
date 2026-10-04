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
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateEntityOrderStatusDto } from './dto/update-entity-order-status.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ORDERS_CREATE)
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() checkoutDto: CheckoutDto,
    @Req() req: any,
  ) {
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
    @Body('ownerId') ownerId: string,
  ) {
    return this.orderService.updateEntityOrderStatus(ownerId, id, updateDto);
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
  ) {
    return this.orderService.getEntityOrders(ownerId, sellingEntityId);
  }
}
