import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { CategoryRepo } from '../../models/category/category.repository';
import slugify from 'slugify';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepo: CategoryRepo) {}

  async create(category: Category) {
    // check category existence
    const categoryExist = await this.categoryRepo.getOne({
      name: category.name,
    });

    if (categoryExist) {
      throw new ConflictException('Category Already Exists');
    }
    return await this.categoryRepo.create(category);
  }

  async findAll() {
    return await this.categoryRepo.getAll({});
  }

  async findOne(id: string) {
    const category = await this.categoryRepo.getOne({ _id: id as any });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const updateData: any = { ...updateCategoryDto };
    if (updateCategoryDto.name) {
      updateData.name = updateCategoryDto.name.trim();
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    const updated = await this.categoryRepo.updateOne({ _id: id as any }, updateData);
    if (!updated) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.categoryRepo.deleteOne({ _id: id as any });
    if (!deleted) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return { success: true, message: 'Category removed successfully', data: deleted };
  }
}

