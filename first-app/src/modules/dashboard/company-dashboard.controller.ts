import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CompanyDashboardService } from './company-dashboard.service';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission, PermissionEnum } from '../../common/enums/permissions.enum';
import { RolesEnum } from '../../common/enums/roles';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['company/dashboard', 'api/company/dashboard'])
export class CompanyDashboardController {
  constructor(
    private readonly companyDashboardService: CompanyDashboardService,
  ) {}

  @UseGuards(AuthenticationGuard)
  @permissions(
    Permission.PRODUCT_READ,
    Permission.ORDER_READ,
    PermissionEnum.ANALYTICS_READ_OWN,
    PermissionEnum.ORDERS_SELLER_READ,
  )
  @Get('overview')
  @HttpCode(HttpStatus.OK)
  async getOverview(
    @Query('period') period: string,
    @Query('sellingEntityId') querySellingEntityId: string,
    @Req() req: any,
  ) {
    const user = req.user;
    const roleUpper = (user?.role || '').toUpperCase().trim();
    const roleLower = (user?.role || '').toLowerCase().trim();
    const isSuperAdmin =
      roleUpper === 'SUPER_ADMIN' ||
      roleLower === 'super_admin' ||
      roleLower === 'superadmin';

    const isAdminWithRead =
      (roleUpper === 'ADMIN' || roleLower === 'admin') &&
      (user?.permissions?.includes(Permission.LEDGER_READ) ||
        user?.permissions?.includes(Permission.ORDER_READ) ||
        user?.permissions?.includes('analytics.read'));

    // Resource Scoping: If not platform admin, verify requested sellingEntityId matches user's entity
    let effectiveEntityIdStr = querySellingEntityId;
    if (!isSuperAdmin && !isAdminWithRead) {
      const userEntityId = user?.sellingEntityId?.toString();
      if (querySellingEntityId && userEntityId && querySellingEntityId !== userEntityId) {
        throw new ForbiddenException(
          'Access denied: You can only access your own selling entity dashboard',
        );
      }
      effectiveEntityIdStr = userEntityId || querySellingEntityId;
    }

    const entityObjectId =
      await this.companyDashboardService.resolveSellingEntityId(
        effectiveEntityIdStr,
        user,
      );

    return this.companyDashboardService.getOverview(entityObjectId, {
      period,
    });
  }
}
