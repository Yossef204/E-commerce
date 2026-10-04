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

      if (!brand || !brand.isActive) {
        throw new BadRequestException(
          'Specified brand is not active or found',
        );
      }

      if (
        brand.sellingEntityId &&
        brand.sellingEntityId.toString() !== entityIdStr
      ) {
        throw new ForbiddenException(
          'Specified brand does not belong to your selling entity',
        );
      }
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
    updateApprovalDto: UpdateApprovalDto,
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

    if (
      updateApprovalDto.approvalStatus === ProductApprovalStatusEnum.REJECTED &&
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
        approvalStatus: updateApprovalDto.approvalStatus,
        rejectionReason:
          updateApprovalDto.approvalStatus === ProductApprovalStatusEnum.REJECTED
            ? updateApprovalDto.rejectionReason.trim()
            : null,
      },
    );

    return {
      message: `Product approval status updated to ${updateApprovalDto.approvalStatus}`,
      data: updatedProduct,
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
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { slug: { $regex: search.trim(), $options: 'i' } },
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
      const activeVariants = (doc.variants || []).filter(
        (v: any) => v.isActive !== false,
      );
      return {
        ...doc,
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
    return {
      success: true,
      data: products,
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
