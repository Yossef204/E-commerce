import { CreateCategoryDto } from '../dto/create-category.dto';
import { Category } from '../entities/category.entity';
import slugify from 'slugify';

export class CategoryFactory {
  createCategory(createCategoryDto: CreateCategoryDto) {
    const newCategory = new Category();
    newCategory.name = createCategoryDto.name.toLowerCase();
    newCategory.slug = slugify(newCategory.name);
    newCategory.image = createCategoryDto.image;
    newCategory.folderId = createCategoryDto.folderId;
    return newCategory;
  }
  updateCategory() {}
}
