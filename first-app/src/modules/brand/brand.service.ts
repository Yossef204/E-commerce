import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandRepo } from '../../models/brand/brand.repository';
import { Brand } from './entities/brand.entity';
import { CategoryRepo } from '../../models/category/category.repository';

@Injectable()
export class BrandService {
  constructor(
    private readonly brandRepo: BrandRepo,
    private readonly categoryRepo: CategoryRepo,
  ) {}
  async create(brand: Brand) {
    const brandExist = await this.brandRepo.getOne({ name: brand.name });
    const categoryExist = await this.categoryRepo.getAll({
      _id: { $in: brand.categoryId },
    });
    if (categoryExist.length != brand.categoryId.length) {
      throw new NotFoundException('Category Not Found');
    }
    if (brandExist) {
      throw new ConflictException('Brand Already Exists');
    }
    return this.brandRepo.create(brand);
  }

  findAll() {
    return `This action returns all brand`;
  }

  findOne(id: number) {
    return `This action returns a #${id} brand`;
  }

  update(id: number, updateBrandDto: UpdateBrandDto) {
    return `This action updates a #${id} brand`;
  }

  remove(id: number) {
    return `This action removes a #${id} brand`;
  }
}
