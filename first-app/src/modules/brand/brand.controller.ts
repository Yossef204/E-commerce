import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandFactory } from './factory/brand.factory';

@Controller('brand')
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly brandFactory: BrandFactory,
  ) {}

  @Post()
  async create(@Body() createBrandDto: CreateBrandDto) {
    const brand = this.brandFactory.createBrand(createBrandDto);
    const createdBrand = await this.brandService.create(brand);
    return {
      message: 'Brand Created Successfully',
      success: true,
      data: createdBrand,
    };
  }

  @Get()
  findAll() {
    return this.brandService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.brandService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBrandDto: UpdateBrandDto) {
    return this.brandService.update(+id, updateBrandDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.brandService.remove(+id);
  }
}
