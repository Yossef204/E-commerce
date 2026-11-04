import { CreateBrandDto } from '../dto/create-brand.dto';
import { Brand } from '../entities/brand.entity';
import slugify from 'slugify';
import { Types } from 'mongoose';

export class BrandFactory {
  createBrand(
    createBrandDto: CreateBrandDto,
    sellingEntityId?: string | Types.ObjectId | null,
  ): Brand {
    const newBrand = new Brand();
    newBrand.name = createBrandDto.name.trim();
    const generatedSlug = slugify(newBrand.name, { lower: true, trim: true });
    newBrand.slug =
      generatedSlug && generatedSlug.length > 0
        ? generatedSlug
        : `brand-${Date.now()}`;
    newBrand.folderId = createBrandDto.folderId;
    newBrand.categoryId = Array.isArray(createBrandDto.categoryId)
      ? createBrandDto.categoryId.map((id) => new Types.ObjectId(id))
      : [];
    newBrand.image = createBrandDto.image;
    newBrand.sellingEntityId = sellingEntityId
      ? new Types.ObjectId(sellingEntityId.toString())
      : null;
    newBrand.isActive = true;
    newBrand.isDeleted = false;
    newBrand.deletedAt = null;
    return newBrand;
  }
}
