import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminPayoutService } from './admin-payout.service';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['admin', 'api/admin'])
export class AdminReportController {
  constructor(private readonly adminPayoutService: AdminPayoutService) {}

  /**
   * GET /admin/reports/vendors/:entityId
   * Return comprehensive financial report and decision-making analytics
   */
  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ANALYTICS_READ)
  @Get('reports/vendors/:entityId')
  async getVendorReport(
    @Param('entityId') entityId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format?: string,
  ) {
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

  /**
   * GET /admin/reports/vendors/:entityId/csv
   * Download vendor financial report as CSV
   */
  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ANALYTICS_READ)
  @Get('reports/vendors/:entityId/csv')
  async exportVendorReportCsv(
    @Param('entityId') entityId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
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
}
