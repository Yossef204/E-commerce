import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandFactory } from './factory/brand.factory';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { Roles } from '../../common/decorators/role.decorators';
import { RolesEnum } from '../../common/enums/roles';
import { Public } from '../../common/decorators/public.decorator';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@ApiTags('Brands')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard, RolesGuard, PermissionsGuard)
@Controller(['brand', 'brands'])
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly brandFactory: BrandFactory,
  ) {}

  @Auditable({ targetEntity: 'Brand', action: AuditActionEnum.CREATE })
  @Roles(
    RolesEnum.ADMIN,
    RolesEnum.SUPER_ADMIN,
    RolesEnum.SELLER,
    RolesEnum.COMPANY_ADMIN,
  )
  @permissions(Permission.BRAND_CREATE_OWN)
  @Post()
  @ApiOperation({ summary: 'Create new brand (Admin or Tenant Seller)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Brand created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing sellingEntityId for tenant or validation error',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient roles or permissions',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Brand name already registered',
  })
  async create(@Body() createBrandDto: CreateBrandDto, @Req() req?: any) {
    const isPlatformAdmin =
      req.user?.role === RolesEnum.ADMIN ||
      req.user?.role === RolesEnum.SUPER_ADMIN ||
      req.user?.role?.toLowerCase() === 'admin' ||
      req.user?.role?.toLowerCase() === 'super_admin';

    const isSeller =
      req.user?.role === RolesEnum.SELLER ||
      req.user?.role === RolesEnum.COMPANY_ADMIN ||
      req.user?.role?.toLowerCase() === 'seller' ||
      req.user?.role?.toLowerCase() === 'company_admin';

    let sellingEntityId = null;
    if (!isPlatformAdmin && isSeller) {
      if (!req.user?.sellingEntityId) {
        throw new BadRequestException(
          'Selling entity ID is required to create a private brand',
        );
      }
      sellingEntityId = req.user.sellingEntityId;
    }

    const brand = this.brandFactory.createBrand(
      createBrandDto,
      sellingEntityId,
    );
    const createdBrand = req?.user
      ? await this.brandService.create(brand, req.user)
      : await this.brandService.create(brand);
    return {
      message: 'Brand Created Successfully',
      success: true,
      data: createdBrand,
    };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all brands' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brands list returned' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Req() req?: any,
  ) {
    const query = {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
    };
    return req?.user
      ? await this.brandService.findAll(query, req.user)
      : await this.brandService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brand details' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid brand ID format',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Brand not found' })
  async findOne(@Param('id') id: string, @Req() req?: any) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid brand ID format');
    }
    return req?.user
      ? await this.brandService.findOne(id, req.user)
      : await this.brandService.findOne(id);
  }

  @Auditable({ targetEntity: 'Brand', action: AuditActionEnum.UPDATE })
  @Roles(
    RolesEnum.ADMIN,
    RolesEnum.SUPER_ADMIN,
    RolesEnum.SELLER,
    RolesEnum.COMPANY_ADMIN,
  )
  @permissions(Permission.BRAND_UPDATE_OWN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update brand (Admin or Brand Owner)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brand updated' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid brand ID format or validation error',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Brand not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot modify global or other tenant brand',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Brand name already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
    @Req() req?: any,
  ) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid brand ID format');
    }
    return req?.user
      ? await this.brandService.update(id, updateBrandDto, req.user)
      : await this.brandService.update(id, updateBrandDto);
  }

  @Auditable({ targetEntity: 'Brand', action: AuditActionEnum.DELETE })
  @Roles(
    RolesEnum.ADMIN,
    RolesEnum.SUPER_ADMIN,
    RolesEnum.SELLER,
    RolesEnum.COMPANY_ADMIN,
  )
  @permissions(Permission.BRAND_DELETE_OWN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete brand (Admin or Brand Owner)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brand deleted' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid brand ID format',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Brand not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot delete global or other tenant brand',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Brand is linked to active products',
  })
  async remove(@Param('id') id: string, @Req() req?: any) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid brand ID format');
    }
    return req?.user
      ? await this.brandService.remove(id, req.user)
      : await this.brandService.remove(id);
  }
}
