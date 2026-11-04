import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Types } from 'mongoose';
import slugify from 'slugify';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandRepo } from '../../models/brand/brand.repository';
import { Brand } from './entities/brand.entity';
import { CategoryRepo } from '../../models/category/category.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { RolesEnum } from '../../common/enums/roles';
import { Permission } from '../../common/enums/permission.enum';

@Injectable()
export class BrandService {
  constructor(
    private readonly brandRepo: BrandRepo,
    private readonly categoryRepo: CategoryRepo,
    @Optional() private readonly productRepo?: ProductRepo,
  ) {}

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isPlatformAdmin(user: any): boolean {
    const roleLower = (user?.role || '').toString().toLowerCase().trim();
    return (
      roleLower === 'admin' ||
      roleLower === 'super_admin' ||
      roleLower === RolesEnum.ADMIN.toLowerCase() ||
      roleLower === RolesEnum.SUPER_ADMIN.toLowerCase()
    );
  }

  private hasGlobalBrandManage(user: any): boolean {
    if (this.isPlatformAdmin(user)) {
      return true;
    }
    const perms: string[] = Array.isArray(user?.permissions)
      ? user.permissions
      : [];
    return (
      perms.includes(Permission.BRAND_MANAGE_ALL) ||
      perms.includes('brand.manage.all') ||
      perms.includes(Permission.BRAND_MANAGE) ||
      perms.includes('brand.manage')
    );
  }

  private verifyMutationOwnership(brand: any, user: any) {
    if (!user) {
      return;
    }

    const hasGlobalManage = this.hasGlobalBrandManage(user);
    const isGlobalBrand = !brand.sellingEntityId;

    if (isGlobalBrand && !hasGlobalManage) {
      throw new ForbiddenException(
        'You do not have permission to modify a global platform brand',
      );
    }

    if (!isGlobalBrand && !hasGlobalManage) {
      const userEntityId = user.sellingEntityId
        ? user.sellingEntityId.toString()
        : null;
      const brandEntityId = brand.sellingEntityId
        ? brand.sellingEntityId.toString()
        : null;

      if (!userEntityId || brandEntityId !== userEntityId) {
        throw new ForbiddenException(
          'You do not have permission to modify another tenant brand',
        );
      }
    }
  }

  async create(brand: Brand, user?: any) {
    if (user) {
      if (this.isPlatformAdmin(user)) {
        brand.sellingEntityId = null;
      } else {
        const roleLower = (user.role || '').toString().toLowerCase().trim();
        if (
          roleLower === 'seller' ||
          roleLower === 'company_admin' ||
          roleLower === RolesEnum.SELLER.toLowerCase() ||
          roleLower === RolesEnum.COMPANY_ADMIN.toLowerCase()
        ) {
          if (!user.sellingEntityId) {
            throw new BadRequestException(
              'Selling entity ID is required to create a private brand',
            );
          }
          brand.sellingEntityId = new Types.ObjectId(
            user.sellingEntityId.toString(),
          );
        }
      }
    }

    const brandExist = await this.brandRepo.getOne({
      name: { $regex: new RegExp(`^${this.escapeRegex(brand.name)}$`, 'i') },
      isDeleted: { $ne: true },
    });
    if (brandExist) {
      throw new ConflictException('اسم العلامة التجارية مسجل بالفعل');
    }

    if (brand.categoryId && brand.categoryId.length > 0) {
      const categoryExist = await this.categoryRepo.getAll({
        _id: { $in: brand.categoryId },
      });
      if (categoryExist.length !== brand.categoryId.length) {
        throw new NotFoundException('Category Not Found');
      }
    }

    try {
      const created = await this.brandRepo.create(brand);
      return typeof (created as any)?.toObject === 'function'
        ? (created as any).toObject()
        : created;
    } catch (error: any) {
      if (
        error?.code === 11000 ||
        (error?.name === 'MongoServerError' &&
          error?.message?.includes('E11000'))
      ) {
        throw new ConflictException('اسم العلامة التجارية مسجل بالفعل');
      }
      throw error;
    }
  }

  async findAll(
    query: { page?: number; limit?: number; search?: string } = {},
    user?: any,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: any = { isDeleted: { $ne: true } };
    if (query.search && typeof query.search === 'string' && query.search.trim()) {
      filter.name = {
        $regex: new RegExp(this.escapeRegex(query.search.trim()), 'i'),
      };
    }

    const [items, total] = await Promise.all([
      this.brandRepo.model
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.brandRepo.model.countDocuments(filter).exec(),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user?: any) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid brand ID format');
    }
    const brand = await this.brandRepo.getOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }
    return typeof (brand as any)?.toObject === 'function'
      ? (brand as any).toObject()
      : brand;
  }

  async update(id: string, updateBrandDto: UpdateBrandDto, user?: any) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid brand ID format');
    }

    const existing = await this.brandRepo.getOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
    });
    if (!existing) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    if (user) {
      this.verifyMutationOwnership(existing, user);
    }

    const updateData: any = {};
    if (updateBrandDto.name) {
      const trimmedName = updateBrandDto.name.trim();
      const duplicate = await this.brandRepo.getOne({
        _id: { $ne: new Types.ObjectId(id) },
        name: { $regex: new RegExp(`^${this.escapeRegex(trimmedName)}$`, 'i') },
        isDeleted: { $ne: true },
      });
      if (duplicate) {
        throw new ConflictException('اسم العلامة التجارية مسجل بالفعل');
      }
      updateData.name = trimmedName;
      const slugVal = slugify(trimmedName, { lower: true, trim: true });
      updateData.slug = slugVal || `brand-${Date.now()}`;
    }

    if (updateBrandDto.categoryId) {
      const catIds = updateBrandDto.categoryId.map(
        (c) => new Types.ObjectId(c),
      );
      const categories = await this.categoryRepo.getAll({
        _id: { $in: catIds },
      });
      if (categories.length !== catIds.length) {
        throw new NotFoundException('Category Not Found');
      }
      updateData.categoryId = catIds;
    }

    if (updateBrandDto.image !== undefined) {
      updateData.image = updateBrandDto.image;
    }
    if (updateBrandDto.folderId !== undefined) {
      updateData.folderId = updateBrandDto.folderId;
    }

    try {
      const updated = await this.brandRepo.updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: updateData },
      );
      return typeof (updated as any)?.toObject === 'function'
        ? (updated as any).toObject()
        : updated;
    } catch (error: any) {
      if (
        error?.code === 11000 ||
        (error?.name === 'MongoServerError' &&
          error?.message?.includes('E11000'))
      ) {
        throw new ConflictException('اسم العلامة التجارية مسجل بالفعل');
      }
      throw error;
    }
  }

  async remove(id: string, user?: any) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid brand ID format');
    }

    const brand = await this.brandRepo.getOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    if (user) {
      this.verifyMutationOwnership(brand, user);
    }

    if (this.productRepo) {
      const productCount = await this.productRepo.model.countDocuments({
        brandId: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });
      if (productCount > 0) {
        throw new ConflictException(
          `Cannot delete brand because it is associated with ${productCount} existing product(s)`,
        );
      }
    }

    const deleted = await this.brandRepo.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );

    return {
      success: true,
      message: 'Brand deleted successfully',
      data:
        typeof (deleted as any)?.toObject === 'function'
          ? (deleted as any).toObject()
          : deleted,
    };
  }
}
