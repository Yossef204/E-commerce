import { ConflictException, Injectable } from '@nestjs/common';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { CategoryRepo } from '../../models/category/category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepo: CategoryRepo) {}
  async create(category: Category) {
    //check category existence
    const categoryExist = await this.categoryRepo.getOne({
      name: category.name,
    });

    //if yes throw conflict
    if (categoryExist) {
      throw new ConflictException('Category Already Exists');
    }
    //create category
    return await this.categoryRepo.create(category);
  }

  findAll() {
    return `This action returns all category`;
  }

  findOne(id: number) {
    return `This action returns a #${id} category`;
  }

  update(id: number, updateCategoryDto: UpdateCategoryDto) {
    return `This action updates a #${id} category`;
  }

  remove(id: number) {
    return `This action removes a #${id} category`;
  }
}
