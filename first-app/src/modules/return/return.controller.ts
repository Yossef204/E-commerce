import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ReturnService } from './return.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { InspectReturnRequestDto } from './dto/inspect-return-request.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@Controller('returns')
export class ReturnController {
  constructor(private readonly returnService: ReturnService) {}

  /**
   * Customer submits a return request for items in a delivered order
   */
  @UseGuards(AuthenticationGuard)
  @Post('request')
  async requestReturn(@Req() req: any, @Body() dto: CreateReturnRequestDto) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.returnService.requestReturn(customerId, dto);
  }

  /**
   * Customer views their own return requests
   */
  @UseGuards(AuthenticationGuard)
  @Get('my-returns')
  async getMyReturns(@Req() req: any) {
    const customerId = new Types.ObjectId(
      req.user?.id || req.user?.sub || req.user?._id,
    );
    return this.returnService.getCustomerReturns(customerId);
  }

  /**
   * Vendor retrieves return requests for their selling entity
   */
  @UseGuards(AuthenticationGuard)
  @Get('vendor/:sellingEntityId')
  async getVendorReturns(
    @Param('sellingEntityId') sellingEntityId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
  ) {
    const entityId = new Types.ObjectId(sellingEntityId);
    return this.returnService.getVendorReturns(
      entityId,
      Number(page),
      Number(limit),
      status,
    );
  }

  /**
   * Vendor / Admin inspects and approves or rejects a return
   */
  @UseGuards(AuthenticationGuard)
  @Patch(':id/inspect')
  async inspectAndApprove(
    @Req() req: any,
    @Param('id') returnId: string,
    @Body() dto: InspectReturnRequestDto,
  ) {
    const userId = req.user?.id || req.user?.sub || req.user?._id;
    return this.returnService.inspectAndApprove(
      userId,
      returnId,
      dto,
      req.user,
    );
  }

  /**
   * Vendor / Admin processes refund, inventory restock, and ledger reversal
   */
  @UseGuards(AuthenticationGuard)
  @Post(':id/refund')
  async processRefund(@Req() req: any, @Param('id') returnId: string) {
    const userId = req.user?.id || req.user?.sub || req.user?._id;
    return this.returnService.processRefund(userId, returnId, req.user);
  }
}

