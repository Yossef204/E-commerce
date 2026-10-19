import { CreateCategoryDto } from '../dto/create-category.dto';
import { Category } from '../entities/category.entity';
import slugify from 'slugify';

export class CategoryFactory {
  createCategory(createCategoryDto: CreateCategoryDto) {
    const newCategory = new Category();
    newCategory.name = createCategoryDto.name.trim();
    newCategory.slug = slugify(newCategory.name, { lower: true, strict: true });
    newCategory.description = createCategoryDto.description;
    newCategory.image = createCategoryDto.image;
    newCategory.folderId = createCategoryDto.folderId;
    return newCategory;
  }
  updateCategory() {}
}
