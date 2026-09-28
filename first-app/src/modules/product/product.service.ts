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
import { ProductFactory } from './factory/product.factory';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductApprovalDto } from './dto/update-product-approval.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { EntityStatusEnum } from '../../common/enums/entity-status.enum';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepo: ProductRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly productFactory: ProductFactory,
  ) {}

  async createProduct(ownerIdStr: string, createProductDto: CreateProductDto) {
    if (!Types.ObjectId.isValid(createProductDto.sellingEntityId)) {
      throw new BadRequestException('Invalid selling entity ID format');
    }
    const sellingEntityId = new Types.ObjectId(
      createProductDto.sellingEntityId,
    );

    const sellingEntity = await this.sellingEntityRepo.getOne({
      _id: sellingEntityId,
    });
    if (!sellingEntity) {
      throw new NotFoundException('Selling entity not found');
    }

    if (sellingEntity.status !== EntityStatusEnum.APPROVED) {
      throw new ForbiddenException(
        'Selling entity must be APPROVED to register products',
      );
    }

    if (sellingEntity.primaryOwnerId.toString() !== ownerIdStr) {
      throw new ForbiddenException('You do not own this selling entity');
    }

    // Check SKU uniqueness
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
    const createdProduct = await this.productRepo.create(productEntity);

    // Initialize inventory records for each variant
    for (let i = 0; i < createdProduct.variants.length; i++) {
      const variant = createdProduct.variants[i];
      const initialStock = createProductDto.variants[i].initialStock || 0;

      await this.inventoryRepo.create({
        sku: variant.sku,
        variantId: variant._id.toString(),
        productId: createdProduct._id,
        availableStock: initialStock,
        reservedStock: 0,
      });
    }

    return {
      message: 'Product created successfully. Pending admin approval.',
      data: createdProduct,
    };
  }

  async updateApprovalStatus(
    productIdStr: string,
    updateApprovalDto: UpdateProductApprovalDto,
  ) {
    if (!Types.ObjectId.isValid(productIdStr)) {
      throw new BadRequestException('Invalid product ID format');
    }
    const productId = new Types.ObjectId(productIdStr);

    const product = await this.productRepo.getOne({ _id: productId });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updatedProduct = await this.productRepo.updateOne(
      { _id: productId },
      {
        approvalStatus: updateApprovalDto.approvalStatus,
        rejectionReason:
          updateApprovalDto.approvalStatus ===
          ProductApprovalStatusEnum.REJECTED
            ? updateApprovalDto.rejectionReason || 'No reason provided'
            : null,
      },
    );

    return {
      message: `Product approval status updated to ${updateApprovalDto.approvalStatus}`,
      data: updatedProduct,
    };
  }

  async findApprovedProducts(categoryIdStr?: string) {
    const filter: any = {
      approvalStatus: ProductApprovalStatusEnum.APPROVED,
    };

    if (categoryIdStr && Types.ObjectId.isValid(categoryIdStr)) {
      filter.categoryId = new Types.ObjectId(categoryIdStr);
    }

    const products = await this.productRepo.getAll(filter);
    return {
      success: true,
      data: products,
    };
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

  async reserveStockAtomic(sku: string, quantity: number) {
    const success = await this.inventoryRepo.reserveStockAtomic(sku, quantity);
    if (!success) {
      throw new BadRequestException(
        `Insufficient available stock for SKU "${sku}"`,
      );
    }
    return {
      success: true,
      message: `Successfully reserved ${quantity} units of SKU "${sku}"`,
    };
  }
}
