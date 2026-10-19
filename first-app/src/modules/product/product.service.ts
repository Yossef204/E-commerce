import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductRepo } from '../../models/product/product.repository';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../models/user/user.repository';
import { BrandRepo } from '../../models/brand/brand.repository';
import { ProductFactory } from './factory/product.factory';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { EntityStatusEnum } from '../../common/enums/entity-status.enum';
import { normalizeImageUrl } from '../storefront/mappers/product.mapper';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepo: ProductRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly userRepo: UserRepo,
    private readonly brandRepo: BrandRepo,
    private readonly productFactory: ProductFactory,
  ) {}

  async createProduct(userContext: any, createProductDto: CreateProductDto) {
    const userId =
      typeof userContext === 'string'
        ? userContext
        : userContext?.sub || userContext?.id;
    let entityIdStr =
      typeof userContext === 'object' ? userContext?.sellingEntityId : null;

    if (!entityIdStr && userId && Types.ObjectId.isValid(userId)) {
      const userDoc = await this.userRepo.getOne({
        _id: new Types.ObjectId(userId),
      });
      entityIdStr = (userDoc as any)?.sellingEntityId?.toString();
      if (!entityIdStr) {
        const entityByOwner = await this.sellingEntityRepo.getOne({
          primaryOwnerId: new Types.ObjectId(userId),
        });
        if (entityByOwner) {
          entityIdStr = entityByOwner._id.toString();
          await this.userRepo.updateOne(
            { _id: new Types.ObjectId(userId) },
            { sellingEntityId: entityByOwner._id },
          );
        }
      }
    }

    if (!entityIdStr) {
      throw new ForbiddenException(
        'User does not belong to an active selling entity',
      );
    }

    const sellingEntityId = new Types.ObjectId(entityIdStr);

    const sellingEntity = await this.sellingEntityRepo.getOne({
      _id: sellingEntityId,
    });
    if (!sellingEntity) {
      throw new NotFoundException('Selling entity not found');
    }

    if (
      sellingEntity.status !== EntityStatusEnum.APPROVED &&
      sellingEntity.status !== EntityStatusEnum.ACTIVE
    ) {
      if (sellingEntity.status === EntityStatusEnum.PENDING_APPROVAL) {
        throw new ForbiddenException(
          'حساب التاجر قيد المراجعة والاعتماد من الإدارة',
        );
      }
      throw new ForbiddenException(
        'Selling entity must be APPROVED or ACTIVE to register products',
      );
    }

    if (createProductDto.brandId) {
      if (!Types.ObjectId.isValid(createProductDto.brandId)) {
        throw new BadRequestException('Invalid brand ID format');
      }

      const brand = await this.brandRepo.getOne({
        _id: new Types.ObjectId(createProductDto.brandId),
      });

      if (!brand) {
        throw new NotFoundException('Specified brand not found');
      }

      if (
        !brand.sellingEntityId ||
        brand.sellingEntityId.toString() !== entityIdStr
      ) {
        throw new ForbiddenException(
          'Specified brand does not belong to your selling entity',
        );
      }
    } else {
      let brand = await this.brandRepo.getOne({
        sellingEntityId: sellingEntityId,
      });
      if (!brand) {
        const brandName = sellingEntity.legalName || 'علامة تجارية';
        const brandSlug =
          brandName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '') || `brand-${Date.now()}`;
        brand = await this.brandRepo.create({
          name: brandName,
          slug: brandSlug,
          sellingEntityId: sellingEntityId,
          isActive: true,
        } as any);
      }
      createProductDto.brandId = brand._id.toString();
    }

    createProductDto.sellingEntityId = entityIdStr;

    if (!createProductDto.variants || createProductDto.variants.length === 0) {
      const defaultSku = `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      createProductDto.variants = [
        {
          sku: defaultSku,
          price: createProductDto.price || 100,
          attributes: { default: 'standard' },
          initialStock: createProductDto.initialStock || 10,
        },
      ];
    }

    for (const vDto of createProductDto.variants) {
      const existingSku = await this.inventoryRepo.getOne({
        sku: vDto.sku.trim(),
      });
      if (existingSku) {
        throw new ConflictException(`SKU "${vDto.sku}" is already in use`);
      }
    }

    const productEntity =
      this.productFactory.createProductEntity(createProductDto);

    productEntity.approvalStatus = ProductApprovalStatusEnum.PENDING_APPROVAL;

    const createdProduct = await this.productRepo.create(productEntity);

    for (const variant of createdProduct.variants) {
      const vDto = createProductDto.variants.find(
        (v) => v.sku.trim() === variant.sku,
      );
      const stock = vDto?.initialStock ?? 10;

      await this.inventoryRepo.create({
        productId: createdProduct._id,
        sku: variant.sku,
        availableStock: stock,
        reservedStock: 0,
      });
    }

    return {
      message: 'Product created successfully and submitted for approval',
      data: createdProduct,
    };
  }

  async updateApprovalStatus(
    productIdStr: string,
    updateApprovalDto: any,
  ) {
    if (!Types.ObjectId.isValid(productIdStr)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.productRepo.getOne({
      _id: new Types.ObjectId(productIdStr),
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const approvalStatus =
      updateApprovalDto.approvalStatus || updateApprovalDto.status;
    if (!approvalStatus) {
      throw new BadRequestException('Approval status is required');
    }

    if (
      approvalStatus === ProductApprovalStatusEnum.REJECTED &&
      (!updateApprovalDto.rejectionReason ||
        !updateApprovalDto.rejectionReason.trim())
    ) {
      throw new BadRequestException(
        'Rejection reason is mandatory when rejecting a product',
      );
    }

    const updatedProduct = await this.productRepo.updateOne(
      { _id: product._id },
      {
        approvalStatus: approvalStatus,
        rejectionReason:
          approvalStatus === ProductApprovalStatusEnum.REJECTED
            ? updateApprovalDto.rejectionReason.trim()
            : null,
      },
    );

    return {
      message: `Product approval status updated to ${approvalStatus}`,
      success: true,
      data: updatedProduct,
    };
  }

  async findAllForAdmin(status?: string) {
    const filter: any = {};
    if (status && status !== 'ALL' && status !== 'all') {
      // دعم البحث بحالة الاعتماد (approvalStatus أو status حسب المخطط)
      filter.$or = [
        { approvalStatus: status },
        { status: status },
      ];
    }

    const products = await this.productRepo.model
      .find(filter)
      .populate('categoryId')
      .populate('brandId')
      .populate('sellingEntityId')
      .sort({ createdAt: -1 })
      .exec();

    const formatted = products.map((product: any) => {
      const doc = product.toObject ? product.toObject() : product;
      const rawImages = [
        doc.image,
        ...(doc.subImages || []),
        ...(doc.images || []),
      ];
      const allImages = rawImages
        .map(normalizeImageUrl)
        .filter((u): u is string => Boolean(u));
      const firstVariant = doc.variants?.[0];

      const categoryObj = doc.categoryId;
      const brandObj = doc.brandId;
      const entityObj = doc.sellingEntityId;

      return {
        ...doc,
        image: allImages[0] || doc.image,
        description: doc.desc || doc.description || '',
        images: allImages.length ? allImages : doc.images || [],
        sellingEntityName:
          entityObj?.tradeName || entityObj?.legalName || 'غير محدد',
        tradeName: entityObj?.tradeName || entityObj?.legalName || 'غير محدد',
        brandName: brandObj?.name || 'غير محدد',
        categoryName: categoryObj?.name || 'غير محدد',
        price: firstVariant?.price || 0,
        stock: firstVariant?.initialStock || 0,
      };
    });

    return {
      success: true,
      data: formatted,
    };
  }

  async findPublicProducts(query: any = {}) {
    const { categoryId, brandId, search, page = 1, limit = 10 } = query;

    const filter: any = {
      approvalStatus: ProductApprovalStatusEnum.APPROVED,
    };

    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      filter.categoryId = new Types.ObjectId(categoryId);
    }

    if (brandId && Types.ObjectId.isValid(brandId)) {
      filter.brandId = new Types.ObjectId(brandId);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { desc: searchRegex },
        { slug: searchRegex },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 10));

    const products = await this.productRepo.getAll(filter, undefined, {
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
      sort: { createdAt: -1 },
    });

    const formattedProducts = products.map((product: any) => {
      const doc = product.toObject ? product.toObject() : product;
      const rawImages = [
        doc.image,
        ...(Array.isArray(doc.subImages) ? doc.subImages : []),
        ...(Array.isArray(doc.images) ? doc.images : []),
      ];
      const normalizedImages = rawImages
        .map(normalizeImageUrl)
        .filter((u): u is string => Boolean(u));

      const activeVariants = (doc.variants || []).filter(
        (v: any) => v.isActive !== false,
      );
      return {
        ...doc,
        image: normalizedImages[0] || doc.image,
        images: normalizedImages.length ? normalizedImages : doc.images,
        variants: activeVariants,
      };
    });

    return {
      success: true,
      page: pageNum,
      limit: limitNum,
      data: formattedProducts,
    };
  }

  async findApprovedProducts(categoryIdStr?: string) {
    return this.findPublicProducts({ categoryId: categoryIdStr });
  }

  async findEntityProducts(sellingEntityIdStr: string) {
    if (!Types.ObjectId.isValid(sellingEntityIdStr)) {
      throw new BadRequestException('Invalid selling entity ID format');
    }
    const sellingEntityId = new Types.ObjectId(sellingEntityIdStr);

    const products = await this.productRepo.getAll({ sellingEntityId });
    const formatted = products.map((product: any) => {
      const doc = product.toObject ? product.toObject() : product;
      const rawImages = [
        doc.image,
        ...(Array.isArray(doc.subImages) ? doc.subImages : []),
        ...(Array.isArray(doc.images) ? doc.images : []),
      ];
      const normalizedImages = rawImages
        .map(normalizeImageUrl)
        .filter((u): u is string => Boolean(u));

      return {
        ...doc,
        image: normalizedImages[0] || doc.image,
        images: normalizedImages.length ? normalizedImages : doc.images,
      };
    });

    return {
      success: true,
      data: formatted,
    };
  }

  public formatProductDoc(product: any) {
    if (!product) return null;
    const doc = product.toObject ? product.toObject() : product;

    const variantImages: string[] = [];
    const formattedVariants = (doc.variants || []).map((v: any) => {
      const vImages = Array.isArray(v.images)
        ? v.images.map(normalizeImageUrl).filter((u): u is string => Boolean(u))
        : [];
      const vImage = v.image ? normalizeImageUrl(v.image) : null;
      if (vImage) variantImages.push(vImage);
      if (vImages.length) variantImages.push(...vImages);
      return {
        ...v,
        image: vImage || v.image,
        images: vImages.length ? vImages : v.images,
      };
    });

    const rawImages = [
      doc.image,
      ...(Array.isArray(doc.subImages) ? doc.subImages : []),
      ...(Array.isArray(doc.images) ? doc.images : []),
      ...variantImages,
    ];
    const normalizedImages = rawImages
      .map(normalizeImageUrl)
      .filter((u): u is string => Boolean(u));

    const categoryObj = doc.categoryId;
    const brandObj = doc.brandId;
    const entityObj = doc.sellingEntityId;
    const firstVariant = formattedVariants[0] || doc.variants?.[0];

    return {
      ...doc,
      image: normalizedImages[0] || doc.image,
      images: normalizedImages.length ? normalizedImages : doc.images || [],
      variants: formattedVariants,
      description: doc.desc || doc.description || '',
      sellingEntityName:
        entityObj?.tradeName || entityObj?.legalName || doc.sellingEntityName || 'غير محدد',
      tradeName: entityObj?.tradeName || entityObj?.legalName || doc.tradeName || 'غير محدد',
      brandName: brandObj?.name || doc.brandName || 'غير محدد',
      categoryName: categoryObj?.name || doc.categoryName || 'غير محدد',
      price: firstVariant?.price || doc.price || 0,
      stock: firstVariant?.initialStock || firstVariant?.availableStock || doc.stock || 0,
    };
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف المنتج غير صالح');
    }
    const product = await this.productRepo.model
      .findById(id)
      .populate('categoryId')
      .populate('brandId')
      .populate('sellingEntityId')
      .exec();

    if (!product) {
      throw new NotFoundException('المنتج المطلوب غير موجود');
    }

    return {
      success: true,
      data: this.formatProductDoc(product),
    };
  }

  async updateInventoryStock(
    ownerIdStr: string,
    updateInventoryDto: UpdateInventoryDto,
  ) {
    const { sku, quantity, operation } = updateInventoryDto;

    const inventory = await this.inventoryRepo.getOne({ sku: sku.trim() });
    if (!inventory) {
      throw new NotFoundException(`Inventory for SKU "${sku}" not found`);
    }

    const product = await this.productRepo.getOne({ _id: inventory.productId });
    if (!product) {
      throw new NotFoundException('Associated product not found');
    }

    const sellingEntity = await this.sellingEntityRepo.getOne({
      _id: product.sellingEntityId,
    });
    if (
      !sellingEntity ||
      sellingEntity.primaryOwnerId.toString() !== ownerIdStr
    ) {
      throw new ForbiddenException(
        'Access denied: You do not own this product inventory',
      );
    }

    let newAvailableStock = inventory.availableStock;
    if (operation === 'ADD') {
      newAvailableStock += quantity;
    } else if (operation === 'SET') {
      newAvailableStock = quantity;
    }

    const updatedInventory = await this.inventoryRepo.updateOne(
      { _id: inventory._id },
      { availableStock: newAvailableStock },
    );

    return {
      message: 'Inventory stock updated successfully',
      data: updatedInventory,
    };
  }

  async reserveStock(
    items: Array<{ productId?: string; variantSku?: string; sku?: string; quantity: number }>,
  ) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Reservation items array must be provided');
    }

    const reservedItems: Array<{ sku: string; quantity: number }> = [];

    for (const item of items) {
      const sku = (item.variantSku || item.sku || '').trim();
      const quantity = Number(item.quantity);

      if (!sku || isNaN(quantity) || quantity <= 0) {
        throw new BadRequestException(`Invalid SKU or quantity for item`);
      }

      const success = await this.inventoryRepo.reserveStockAtomic(sku, quantity);
      if (!success) {
        for (const prev of reservedItems) {
          await this.inventoryRepo.releaseStockAtomic(prev.sku, prev.quantity);
        }
        throw new ConflictException(`Insufficient stock for SKU: ${sku}`);
      }

      reservedItems.push({ sku, quantity });
    }

    return {
      success: true,
      message: `Stock reserved successfully for ${reservedItems.length} item(s)`,
    };
  }

  async reserveStockAtomic(sku: string, quantity: number) {
    return this.reserveStock([{ sku, quantity }]);
  }
}
