import { CreateBrandDto } from '../dto/create-brand.dto';
import { Brand } from '../entities/brand.entity';
import slugify from 'slugify';
import { Types } from 'mongoose';

export class BrandFactory {
  createBrand(createBrandDto: CreateBrandDto) {
    const newBrand = new Brand();
    newBrand.name = createBrandDto.name.toLowerCase();
    newBrand.slug = slugify(newBrand.name);
    newBrand.folderId = createBrandDto.folderId;
    newBrand.categoryId = createBrandDto.categoryId.map(
      (id) => new Types.ObjectId(id),
    );
    newBrand.image = createBrandDto.image;
    return newBrand;
  }
}
