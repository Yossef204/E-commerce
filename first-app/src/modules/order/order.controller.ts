import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
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

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(AuthenticationGuard)
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() checkoutDto: CheckoutDto,
    @Body('customerId') customerId: string,
  ) {
    return this.orderService.checkout(customerId, checkoutDto);
  }

  @UseGuards(AuthenticationGuard)
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
  @Get('my-orders/:customerId')
  async getCustomerOrders(@Param('customerId') customerId: string) {
    return this.orderService.getCustomerOrders(customerId);
  }

  @UseGuards(AuthenticationGuard)
  @Get('entity/:sellingEntityId')
  async getEntityOrders(
    @Param('sellingEntityId') sellingEntityId: string,
    @Query('ownerId') ownerId: string,
  ) {
    return this.orderService.getEntityOrders(ownerId, sellingEntityId);
  }
}

