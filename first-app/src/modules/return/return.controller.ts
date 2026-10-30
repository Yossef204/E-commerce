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
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ReturnService } from './return.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { InspectReturnRequestDto } from './dto/inspect-return-request.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { RolesEnum } from '../../common/enums/roles';

@ApiTags('Returns & Refunds')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@Controller('returns')
export class ReturnController {
  constructor(private readonly returnService: ReturnService) {}

  /**
   * Customer submits a return request for items in a delivered order
   */
  @permissions(Permission.RETURN_REQUEST)
  @Post('request')
  @ApiOperation({
    summary: 'Submit return request for delivered order',
    description:
      'Customer requests return of items from a DELIVERED order within the 14-day legal return window. Calculates refund amount.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Return request submitted successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Order not delivered or 14-day window expired' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Cannot return an order belonging to another customer' })
  async requestReturn(@Req() req: any, @Body() dto: CreateReturnRequestDto) {
    const customerId = req.user?.id || req.user?.sub || req.user?._id;
    return this.returnService.requestReturn(customerId, dto);
  }

  /**
   * Customer views their own return requests
   */
  @permissions(Permission.RETURN_READ_OWN)
  @Get('my-returns')
  @ApiOperation({
    summary: 'Customer view own return requests',
    description: 'Returns all return requests filed by the authenticated customer with real-time status and refund details',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customer returns list returned' })
  async getMyReturns(@Req() req: any) {
    const customerId = new Types.ObjectId(
      req.user?.id || req.user?.sub || req.user?._id,
    );
    return this.returnService.getCustomerReturns(customerId);
  }

  /**
   * Vendor retrieves return requests for their selling entity
   */
  @permissions(Permission.RETURN_READ_ENTITY)
  @Get('vendor/:sellingEntityId')
  @ApiOperation({
    summary: 'Vendor view incoming return requests',
    description: 'Vendor lists all return requests filed against their commercial entity with status filtering and pagination',
  })
  @ApiParam({ name: 'sellingEntityId', description: 'Vendor SellingEntity ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page limit' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by ReturnStatusEnum' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Vendor returns list' })
  async getVendorReturns(
    @Param('sellingEntityId') sellingEntityId: string,
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
  ) {
    if (req?.user) {
      const role = (req.user.role || '').toLowerCase();
      const isSuperAdmin =
        role === 'admin' ||
        role === 'super_admin' ||
        role === RolesEnum.SUPER_ADMIN.toLowerCase();
      if (!isSuperAdmin && req.user.sellingEntityId && req.user.sellingEntityId.toString() !== sellingEntityId) {
        throw new ForbiddenException('غير مصرح لك باستعراض طلبات إرجاع متجر آخر');
      }
    }

    const entityId = new Types.ObjectId(sellingEntityId);
    return this.returnService.getVendorReturns(
      entityId,
      Number(page),
      Number(limit),
      status,
    );
  }

  /**
   * Get single return request by ID (enforces resource ownership scoping)
   */
  @permissions(Permission.RETURN_READ_OWN)
  @Get(':id')
  @ApiOperation({
    summary: 'Get return request by ID',
    description: 'Retrieves return request details. Enforces customer or vendor resource ownership.',
  })
  @ApiParam({ name: 'id', description: 'ReturnRequest MongoDB ObjectId' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return request details' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Return request not found' })
  async getReturnById(@Req() req: any, @Param('id') returnId: string) {
    const authenticatedUserId = req.user?.id || req.user?.sub || req.user?._id;
    return this.returnService.getReturnById(returnId, authenticatedUserId, req.user);
  }

  /**
   * Vendor / Admin inspects and approves or rejects a return
   */
  @permissions(Permission.RETURN_INSPECT)
  @Patch(':id/inspect')
  @ApiOperation({
    summary: 'Inspect returned item condition',
    description:
      'Vendor or Admin inspects returned physical item condition (RESALABLE, DAMAGED_RESTOCKABLE, DAMAGED_DISCARD) and updates status to INSPECTED/REJECTED',
  })
  @ApiParam({ name: 'id', description: 'ReturnRequest MongoDB ObjectId' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return inspection status updated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Vendor not authorized to inspect another vendor return' })
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
  @permissions(Permission.REFUND_EXECUTE)
  @Post(':id/refund')
  @ApiOperation({
    summary: 'Execute financial refund and ledger reversal',
    description:
      'Processes monetary refund (Payment gateway or customer wallet), restores stock if resalable, and creates REFUND_DEBIT ledger movements',
  })
  @ApiParam({ name: 'id', description: 'ReturnRequest MongoDB ObjectId' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Refund executed and ledger settled' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Return not inspected or already refunded' })
  async processRefund(@Req() req: any, @Param('id') returnId: string) {
    const userId = req.user?.id || req.user?.sub || req.user?._id;
    return this.returnService.processRefund(userId, returnId, req.user);
  }
}
