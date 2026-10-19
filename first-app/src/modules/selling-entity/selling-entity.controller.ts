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
import { SellingEntityService } from './selling-entity.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateIndependentSellerDto } from './dto/create-independent-seller.dto';
import { UpdateEntityStatusDto } from './dto/update-entity-status.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('selling-entities')
export class SellingEntityController {
  constructor(private readonly sellingEntityService: SellingEntityService) {}

  @UseGuards(AuthenticationGuard)
  @Post('company')
  async registerCompany(
    @Req() req: any,
    @Body() createCompanyDto: CreateCompanyDto,
  ) {
    const ownerId = req.user.sub;
    return this.sellingEntityService.registerCompany(ownerId, createCompanyDto);
  }

  @UseGuards(AuthenticationGuard)
  @Post('independent-seller')
  async registerIndependentSeller(
    @Req() req: any,
    @Body() createIndependentSellerDto: CreateIndependentSellerDto,
  ) {
    const ownerId = req.user.sub;
    return this.sellingEntityService.registerIndependentSeller(
      ownerId,
      createIndependentSellerDto,
    );
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.SELLING_ENTITY_APPROVE)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateEntityStatusDto,
  ) {
    return this.sellingEntityService.updateStatus(id, updateStatusDto);
  }

  @UseGuards(AuthenticationGuard)
  @Get('profile/:ownerId')
  async getProfile(@Req() req: any, @Param('ownerId') ownerId: string) {
    const role = (req.user?.role || '').toLowerCase();
    const isSuperAdmin = role === 'admin' || role === 'super_admin';
    const currentUserId = req.user?.sub || req.user?.id || req.user?._id?.toString();
    if (!isSuperAdmin && currentUserId !== ownerId) {
      throw new ForbiddenException('You can only view your own entity profile');
    }
    return this.sellingEntityService.getProfile(ownerId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.ANALYTICS_READ_OWN)
  @Get(':id/dashboard-metrics')
  async getDashboardMetrics(@Param('id') id: string) {
    return this.sellingEntityService.getDashboardMetrics(id);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.SELLING_ENTITY_READ)
  @Get()
  async findAll() {
    return this.sellingEntityService.findAll();
  }
}