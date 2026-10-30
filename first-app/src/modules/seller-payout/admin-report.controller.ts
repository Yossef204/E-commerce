import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
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
import type { Response } from 'express';
import { AdminPayoutService } from './admin-payout.service';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { RolesEnum } from '../../common/enums/roles';

@ApiTags('Admin Finance')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['admin', 'api/admin'])
export class AdminReportController {
  constructor(private readonly adminPayoutService: AdminPayoutService) {}

  /**
   * GET /admin/reports/vendors/:entityId
   * Return comprehensive financial report and decision-making analytics
   */
  @permissions(Permission.ANALYTICS_READ_ALL)
  @Get('reports/vendors/:entityId')
  @ApiOperation({
    summary: 'Get vendor financial analytics report',
    description: 'Generates comprehensive vendor statement, net payouts, platform fees, and escrow status. Supports CSV export.',
  })
  @ApiParam({ name: 'entityId', description: 'Vendor SellingEntity ID' })
  @ApiQuery({ name: 'period', required: false, description: 'today, week, month, year' })
  @ApiQuery({ name: 'format', required: false, description: 'json or csv' })
  @ApiResponse({ status: 200, description: 'Financial report generated' })
  async getVendorReport(
    @Param('entityId') entityId: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req?: any,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format?: string,
  ) {
    if (req?.user) {
      const role = (req.user.role || '').toLowerCase();
      const isSuperAdmin =
        role === 'admin' ||
        role === 'super_admin' ||
        role === RolesEnum.SUPER_ADMIN.toLowerCase();
      if (!isSuperAdmin && req.user.sellingEntityId && req.user.sellingEntityId.toString() !== entityId) {
        throw new ForbiddenException('غير مصرح لك باستعراض التقارير المالية لمتجر آخر');
      }
    }

    if (format === 'csv') {
      const csv = await this.adminPayoutService.generateVendorReportCsv(entityId, {
        period,
        startDate,
        endDate,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=vendor-report-${entityId}.csv`,
      );
      return csv;
    }

    const data = await this.adminPayoutService.getFullVendorReportAndAnalytics(
      entityId,
      {
        period,
        startDate,
        endDate,
      },
    );

    return {
      success: true,
      data,
    };
  }
}
