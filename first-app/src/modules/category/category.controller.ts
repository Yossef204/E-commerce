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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryFactory } from './factory/category.factory';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { Public } from '../../common/decorators/public.decorator';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@ApiTags('Categories')
@ApiBearerAuth('JWT-auth')
@Controller(['category', 'categories'])
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly categoryFactory: CategoryFactory,
  ) {}

  @Auditable({ targetEntity: 'Category', action: AuditActionEnum.CREATE })
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.CATEGORY_MANAGE)
  @Post()
  @ApiOperation({ summary: 'Create category (Admin only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Category created successfully' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    const category = this.categoryFactory.createCategory(createCategoryDto);
    const createdCategory = await this.categoryService.create(category);
    return {
      message: 'Category Created Successfully',
      success: true,
      data: createdCategory,
    };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Categories list' })
  async findAll() {
    return await this.categoryService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Category details' })
  async findOne(@Param('id') id: string) {
    return await this.categoryService.findOne(id);
  }

  @Auditable({ targetEntity: 'Category', action: AuditActionEnum.UPDATE })
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.CATEGORY_MANAGE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update category (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Category updated' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    const updated = await this.categoryService.update(id, updateCategoryDto);
    return {
      message: 'Category Updated Successfully',
      success: true,
      data: updated,
    };
  }

  @Auditable({ targetEntity: 'Category', action: AuditActionEnum.DELETE })
  @UseGuards(AuthenticationGuard)
  @permissions(Permission.CATEGORY_MANAGE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete category (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Category deleted' })
  async remove(@Param('id') id: string) {
    return await this.categoryService.remove(id);
  }
}
