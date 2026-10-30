import {
  Controller,
  Get,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission, PermissionEnum } from '../../common/enums/permissions.enum';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['admin/dashboard', 'api/admin/dashboard'])
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(
    Permission.AUDIT_LOG_READ,
    Permission.LEDGER_READ,
    PermissionEnum.AUDIT_LOGS_READ,
    PermissionEnum.ANALYTICS_READ,
    PermissionEnum.PLATFORM_SUPER_ADMIN,
  )
  @Get('overview')
  @HttpCode(HttpStatus.OK)
  async getOverview() {
    return this.adminDashboardService.getOverview();
  }
}
