import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryFactory } from './factory/category.factory';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

@Controller(['category', 'categories'])
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly categoryFactory: CategoryFactory,
  ) {}

  @UseGuards(AuthenticationGuard)
  @Post()
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    const category = this.categoryFactory.createCategory(createCategoryDto);
    const createdCategory = await this.categoryService.create(category);
    return {
      message: 'Category Created Successfully',
      success: true,
      data: createdCategory,
    };
  }

  @Get()
  async findAll() {
    return await this.categoryService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.categoryService.findOne(id);
  }

  @UseGuards(AuthenticationGuard)
  @Patch(':id')
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

  @UseGuards(AuthenticationGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.categoryService.remove(id);
  }
}

