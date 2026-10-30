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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandFactory } from './factory/brand.factory';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Brands')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@Controller('brand')
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly brandFactory: BrandFactory,
  ) {}

  @permissions(Permission.BRAND_MANAGE)
  @Post()
  @ApiOperation({ summary: 'Create new brand (Admin only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Brand created successfully' })
  async create(@Body() createBrandDto: CreateBrandDto) {
    const brand = this.brandFactory.createBrand(createBrandDto);
    const createdBrand = await this.brandService.create(brand);
    return {
      message: 'Brand Created Successfully',
      success: true,
      data: createdBrand,
    };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all brands' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brands list returned' })
  findAll() {
    return this.brandService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brand details' })
  findOne(@Param('id') id: string) {
    return this.brandService.findOne(+id);
  }

  @permissions(Permission.BRAND_MANAGE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update brand (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brand updated' })
  update(@Param('id') id: string, @Body() updateBrandDto: UpdateBrandDto) {
    return this.brandService.update(+id, updateBrandDto);
  }

  @permissions(Permission.BRAND_MANAGE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete brand (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brand deleted' })
  remove(@Param('id') id: string) {
    return this.brandService.remove(+id);
  }
}
