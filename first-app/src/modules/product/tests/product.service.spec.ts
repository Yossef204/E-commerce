import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import { ProductService } from '../product.service';
import { ProductFactory } from '../factory/product.factory';
import { ProductRepo } from '../../../models/product/product.repository';
import { InventoryRepo } from '../../../models/inventory/inventory.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../../models/user/user.repository';
import { BrandRepo } from '../../../models/brand/brand.repository';
import { CategoryRepo } from '../../../models/category/category.repository';
import { Product } from '../../../models/product/product.schema';
import { Inventory } from '../../../models/inventory/inventory.schema';
import { Category } from '../../../models/category/category.schema';
import { SellingEntity } from '../../../models/selling-entity/selling-entity.schema';
import { ProductApprovalStatusEnum } from '../../../common/enums/product-approval-status.enum';
import { EntityStatusEnum } from '../../../common/enums/entity-status.enum';
import { RolesEnum } from '../../../common/enums/roles';
import { CreateProductDto } from '../dto/create-product.dto';

describe('ProductService', () => {
  let service: ProductService;
  let productRepo: any;
  let inventoryRepo: any;
  let sellingEntityRepo: any;
  let userRepo: any;
  let brandRepo: any;
  let categoryRepo: any;
  let eventEmitter: any;

  const mockSellerUserId = new Types.ObjectId('650000000000000000000010');
  const mockSellerEntityId = new Types.ObjectId('650000000000000000000020');
  const mockOtherEntityId = new Types.ObjectId('650000000000000000000088');
  const mockCategoryId = new Types.ObjectId('650000000000000000000030');
  const mockBrandId = new Types.ObjectId('650000000000000000000040');
  const mockProductId = new Types.ObjectId('650000000000000000000050');
  const mockInventoryId = new Types.ObjectId('650000000000000000000060');

  const mockSellerUser = {
    id: mockSellerUserId.toString(),
    sub: mockSellerUserId.toString(),
    role: RolesEnum.SELLER,
    sellingEntityId: mockSellerEntityId.toString(),
    permissions: [],
  };

  const mockSuperAdminUser = {
    id: new Types.ObjectId('650000000000000000000001').toString(),
    role: 'SUPER_ADMIN',
    permissions: ['all'],
  };

  const mockSellingEntity = {
    _id: mockSellerEntityId,
    legalName: 'Alpha Trading LLC',
    tradeName: 'Alpha Store',
    status: EntityStatusEnum.APPROVED,
    primaryOwnerId: mockSellerUserId,
  };

  const mockCategory = {
    _id: mockCategoryId,
    name: 'Electronics',
    slug: 'electronics',
    isActive: true,
  };

  const mockBrand = {
    _id: mockBrandId,
    name: 'AlphaBrand',
    slug: 'alphabrand',
    sellingEntityId: mockSellerEntityId,
    isActive: true,
  };

  beforeEach(async () => {
    productRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((doc) =>
        Promise.resolve({
          _id: mockProductId,
          ...doc,
        }),
      ),
      updateOne: jest.fn().mockImplementation((filter, update) =>
        Promise.resolve({
          _id: filter._id,
          ...update,
        }),
      ),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      model: {
        find: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      },
    };

    inventoryRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          _id: mockInventoryId,
          ...data,
        }),
      ),
      updateOne: jest.fn().mockImplementation((filter, update) =>
        Promise.resolve({
          _id: filter._id,
          ...update,
        }),
      ),
      reserveStockAtomic: jest.fn().mockResolvedValue(true),
      releaseStockAtomic: jest.fn().mockResolvedValue(true),
    };

    sellingEntityRepo = {
      getOne: jest.fn().mockResolvedValue(mockSellingEntity),
    };

    userRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    brandRepo = {
      getOne: jest.fn().mockResolvedValue(mockBrand),
      create: jest.fn().mockResolvedValue(mockBrand),
    };

    categoryRepo = {
      getOne: jest.fn().mockResolvedValue(mockCategory),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        ProductFactory,
        { provide: ProductRepo, useValue: productRepo },
        { provide: InventoryRepo, useValue: inventoryRepo },
        { provide: SellingEntityRepo, useValue: sellingEntityRepo },
        { provide: UserRepo, useValue: userRepo },
        { provide: BrandRepo, useValue: brandRepo },
        { provide: CategoryRepo, useValue: categoryRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: getModelToken(Product.name), useValue: {} },
        { provide: getModelToken(Inventory.name), useValue: {} },
        { provide: getModelToken(Category.name), useValue: {} },
        { provide: getModelToken(SellingEntity.name), useValue: {} },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProduct & Approval Flow', () => {
    it('should create a product with PENDING_APPROVAL status and correct sellingEntityId for sellers', async () => {
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);
      categoryRepo.getOne.mockResolvedValue(mockCategory);
      brandRepo.getOne.mockResolvedValue(mockBrand);
      inventoryRepo.getOne.mockResolvedValue(null);

      const dto: CreateProductDto = {
        title: 'Alpha Wireless Earbuds',
        desc: 'Premium noise canceling earbuds',
        categoryId: mockCategoryId.toString(),
        brandId: mockBrandId.toString(),
        price: 299,
        variants: [
          {
            sku: 'EAR-BLK-01',
            price: 299,
            initialStock: 40,
            attributes: { color: 'Black' },
          },
        ],
      };

      const result = await service.createProduct(mockSellerUser, dto);

      expect(result.data).toBeDefined();
      expect(result.data.approvalStatus).toBe(
        ProductApprovalStatusEnum.PENDING_APPROVAL,
      );
      expect(result.data.sellingEntityId.toString()).toBe(
        mockSellerEntityId.toString(),
      );
      expect(productRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalStatus: ProductApprovalStatusEnum.PENDING_APPROVAL,
          sellingEntityId: mockSellerEntityId,
        }),
      );
      expect(inventoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'EAR-BLK-01',
          availableStock: 40,
        }),
      );
    });

    it('should throw BadRequestException if category does not exist', async () => {
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);
      categoryRepo.getOne.mockResolvedValue(null); // Category not found

      const dto: CreateProductDto = {
        title: 'Alpha Wireless Earbuds',
        categoryId: new Types.ObjectId('650000000000000000000099').toString(),
        price: 299,
      };

      await expect(
        service.createProduct(mockSellerUser, dto),
      ).rejects.toThrow(BadRequestException);

      expect(productRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('Ownership & Scoping (assertProductOwnership)', () => {
    const existingSellerProduct = {
      _id: mockProductId,
      title: 'Alpha Smartwatch',
      sellingEntityId: mockSellerEntityId,
      approvalStatus: ProductApprovalStatusEnum.APPROVED,
    };

    const foreignVendorProduct = {
      _id: mockProductId,
      title: 'Foreign Vendor Item',
      sellingEntityId: mockOtherEntityId,
      approvalStatus: ProductApprovalStatusEnum.APPROVED,
    };

    it('should allow seller to update their own product', async () => {
      productRepo.getOne.mockResolvedValue(existingSellerProduct);

      const result = await service.updateProduct(
        mockProductId.toString(),
        { title: 'Alpha Smartwatch V2' },
        mockSellerUser,
      );

      expect(result.data).toBeDefined();
      expect(productRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockProductId },
        expect.objectContaining({
          $set: expect.objectContaining({
            title: 'Alpha Smartwatch V2',
            approvalStatus: ProductApprovalStatusEnum.PENDING_APPROVAL,
          }),
        }),
      );
    });

    it('should throw ForbiddenException if seller attempts to update another vendor product', async () => {
      productRepo.getOne.mockResolvedValue(foreignVendorProduct);
      sellingEntityRepo.getOne.mockResolvedValue({
        _id: mockOtherEntityId,
        primaryOwnerId: new Types.ObjectId('650000000000000000000999'),
      });

      await expect(
        service.updateProduct(
          mockProductId.toString(),
          { title: 'Hacked Title' },
          mockSellerUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(productRepo.updateOne).not.toHaveBeenCalled();
    });

    it('should allow SUPER_ADMIN to bypass ownership checks', async () => {
      productRepo.getOne.mockResolvedValue(foreignVendorProduct);

      const result = await service.updateProduct(
        mockProductId.toString(),
        { title: 'Admin Moderated Title' },
        mockSuperAdminUser,
      );

      expect(result.data).toBeDefined();
      expect(productRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockProductId },
        expect.objectContaining({
          $set: expect.objectContaining({
            title: 'Admin Moderated Title',
          }),
        }),
      );
    });
  });

  describe('Admin Moderation (updateApprovalStatus)', () => {
    const pendingProduct = {
      _id: mockProductId,
      title: 'Pending Moderation Product',
      approvalStatus: ProductApprovalStatusEnum.PENDING_APPROVAL,
      isActive: false,
    };

    it('should approve product and make it active on store upon admin approval', async () => {
      productRepo.getOne.mockResolvedValue(pendingProduct);

      const result = await service.updateApprovalStatus(
        mockProductId.toString(),
        { approvalStatus: ProductApprovalStatusEnum.APPROVED },
      );

      expect(result.success).toBe(true);
      expect(productRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockProductId },
        expect.objectContaining({
          approvalStatus: ProductApprovalStatusEnum.APPROVED,
          isActive: true,
          status: 'ACTIVE',
          rejectionReason: null,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'product.approval_updated',
        expect.objectContaining({
          productId: mockProductId,
          approvalStatus: ProductApprovalStatusEnum.APPROVED,
        }),
      );
    });

    it('should reject product and store rejection reason upon admin rejection', async () => {
      productRepo.getOne.mockResolvedValue(pendingProduct);

      const result = await service.updateApprovalStatus(
        mockProductId.toString(),
        {
          approvalStatus: ProductApprovalStatusEnum.REJECTED,
          rejectionReason: 'Invalid certification documents provided',
        },
      );

      expect(result.success).toBe(true);
      expect(productRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockProductId },
        expect.objectContaining({
          approvalStatus: ProductApprovalStatusEnum.REJECTED,
          rejectionReason: 'Invalid certification documents provided',
          isActive: false,
          status: 'INACTIVE',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'product.approval_updated',
        expect.objectContaining({
          productId: mockProductId,
          approvalStatus: ProductApprovalStatusEnum.REJECTED,
          rejectionReason: 'Invalid certification documents provided',
        }),
      );
    });

    it('should throw BadRequestException if rejection reason is missing when rejecting', async () => {
      productRepo.getOne.mockResolvedValue(pendingProduct);

      await expect(
        service.updateApprovalStatus(mockProductId.toString(), {
          approvalStatus: ProductApprovalStatusEnum.REJECTED,
          rejectionReason: '',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(productRepo.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('Inventory Management & Variants (updateInventoryStock)', () => {
    const existingInventory = {
      _id: mockInventoryId,
      productId: mockProductId,
      sku: 'EAR-BLK-01',
      availableStock: 20,
      reservedStock: 0,
    };

    const linkedProduct = {
      _id: mockProductId,
      sellingEntityId: mockSellerEntityId,
    };

    it('should update stock for a specific SKU/variant successfully', async () => {
      inventoryRepo.getOne.mockResolvedValue(existingInventory);
      productRepo.getOne.mockResolvedValue(linkedProduct);

      const result = await service.updateInventoryStock(mockSellerUser, {
        sku: 'EAR-BLK-01',
        quantity: 15,
        operation: 'ADD',
      });

      expect(inventoryRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockInventoryId },
        { availableStock: 35 },
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'inventory.stock_updated',
        expect.objectContaining({
          sku: 'EAR-BLK-01',
          availableStock: 35,
        }),
      );
      expect(result.data).toBeDefined();
    });

    it('should throw BadRequestException on negative stock values', async () => {
      inventoryRepo.getOne.mockResolvedValue(existingInventory);
      productRepo.getOne.mockResolvedValue(linkedProduct);

      // 1. Negative quantity input
      await expect(
        service.updateInventoryStock(mockSellerUser, {
          sku: 'EAR-BLK-01',
          quantity: -10,
          operation: 'ADD',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(inventoryRepo.updateOne).not.toHaveBeenCalled();
    });
  });
});

