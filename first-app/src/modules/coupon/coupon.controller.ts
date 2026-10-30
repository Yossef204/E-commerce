import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateVendorCouponDto } from './dto/create-vendor-coupon.dto';
import { CreatePlatformCouponDto } from './dto/create-platform-coupon.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { UpdateCouponStatusDto } from './dto/update-coupon-status.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.COUPONS_MANAGE_OWN)
  @Post(['vendor', ''])
  @HttpCode(HttpStatus.CREATED)
  async createVendorCoupon(
    @Request() req: any,
    @Body() dto: CreateVendorCouponDto,
  ) {
    const sellingEntityId =
      req.user?.sellingEntityId || req.body?.sellingEntityId;
    if (!sellingEntityId) {
      throw new ForbiddenException(
        'User is not associated with an active selling entity',
      );
    }
    return this.couponService.createVendorCoupon(sellingEntityId, dto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.COUPONS_MANAGE_OWN)
  @Get(['my-coupons', 'vendor'])
  async getMyCoupons(@Request() req: any) {
    const sellingEntityId =
      req.user?.sellingEntityId || req.query?.sellingEntityId;
    if (!sellingEntityId) {
      throw new ForbiddenException(
        'User is not associated with an active selling entity',
      );
    }
    return this.couponService.getVendorCoupons(sellingEntityId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.COUPONS_MANAGE_GLOBAL)
  @Post('platform')
  @HttpCode(HttpStatus.CREATED)
  async createPlatformCoupon(@Body() dto: CreatePlatformCouponDto) {
    return this.couponService.createPlatformCoupon(dto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.COUPONS_MANAGE_GLOBAL)
  @Get('admin/all')
  async getAllCoupons() {
    return this.couponService.getAllCoupons();
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.COUPONS_MANAGE_GLOBAL)
  @Patch('admin/:id/status')
  async updateCouponStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCouponStatusDto,
  ) {
    return this.couponService.updateCouponStatus(id, dto.isActive);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.CART_MANAGE)
  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyCoupon(@Request() req: any, @Body() dto: ApplyCouponDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.couponService.validateAndApplyCoupon(
      dto.code,
      userId,
      dto.items,
    );
  }
}
