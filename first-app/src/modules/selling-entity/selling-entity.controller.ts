import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SellingEntityService } from './selling-entity.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateIndependentSellerDto } from './dto/create-independent-seller.dto';
import { UpdateEntityStatusDto } from './dto/update-entity-status.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { RolesEnum } from '../../common/enums/roles';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@ApiTags('Selling Entities')
@ApiBearerAuth('JWT-auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('selling-entities')
export class SellingEntityController {
  constructor(private readonly sellingEntityService: SellingEntityService) {}

  @Auditable({ targetEntity: 'SellingEntity', action: AuditActionEnum.CREATE })
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PROFILE_UPDATE)
  @Post('company')
  @ApiOperation({ summary: 'Register company merchant entity' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Company registered' })
  async registerCompany(
    @Req() req: any,
    @Body() createCompanyDto: CreateCompanyDto,
  ) {
    const ownerId = req.user.sub || req.user.id;
    return this.sellingEntityService.registerCompany(ownerId, createCompanyDto);
  }

  @Auditable({ targetEntity: 'SellingEntity', action: AuditActionEnum.CREATE })
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PROFILE_UPDATE)
  @Post('independent-seller')
  @ApiOperation({ summary: 'Register independent seller merchant entity' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Seller registered' })
  async registerIndependentSeller(
    @Req() req: any,
    @Body() createIndependentSellerDto: CreateIndependentSellerDto,
  ) {
    const ownerId = req.user.sub || req.user.id;
    return this.sellingEntityService.registerIndependentSeller(
      ownerId,
      createIndependentSellerDto,
    );
  }

  @Auditable({ targetEntity: 'SellingEntity', action: AuditActionEnum.STATUS_CHANGE })
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.SELLING_ENTITY_APPROVE)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update merchant approval status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Selling Entity ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Merchant status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateEntityStatusDto,
  ) {
    return this.sellingEntityService.updateStatus(id, updateStatusDto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.SELLING_ENTITY_READ_OWN)
  @Get('profile/:ownerId')
  @ApiOperation({ summary: 'Get merchant profile' })
  @ApiParam({ name: 'ownerId', description: 'Primary Owner User ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Merchant profile returned' })
  async getProfile(@Req() req: any, @Param('ownerId') ownerId: string) {
    const role = (req.user?.role || '').toLowerCase();
    const isSuperAdmin =
      role === 'admin' ||
      role === 'super_admin' ||
      role === RolesEnum.SUPER_ADMIN.toLowerCase();
    const currentUserId = (req.user?.sub || req.user?.id || req.user?._id)?.toString();
    if (!isSuperAdmin && currentUserId !== ownerId) {
      throw new ForbiddenException('You can only view your own entity profile');
    }
    return this.sellingEntityService.getProfile(ownerId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ANALYTICS_READ_OWN)
  @Get(':id/dashboard-metrics')
  @ApiOperation({ summary: 'Get merchant operational metrics' })
  @ApiParam({ name: 'id', description: 'Selling Entity ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dashboard metrics returned' })
  async getDashboardMetrics(@Param('id') id: string, @Req() req?: any) {
    if (req?.user) {
      const role = (req.user.role || '').toLowerCase();
      const isSuperAdmin =
        role === 'admin' ||
        role === 'super_admin' ||
        role === RolesEnum.SUPER_ADMIN.toLowerCase();
      if (!isSuperAdmin && req.user.sellingEntityId && req.user.sellingEntityId.toString() !== id) {
        throw new ForbiddenException('غير مصرح لك باستعراض مقاييس متجر آخر');
      }
    }
    return this.sellingEntityService.getDashboardMetrics(id);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.SELLING_ENTITY_READ_ALL)
  @Get()
  @ApiOperation({ summary: 'List all selling entities (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Entities list returned' })
  async findAll() {
    return this.sellingEntityService.findAll();
  }
}
