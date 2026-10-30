import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductApprovalDto } from './dto/update-product-approval.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

describe('ProductController', () => {
  let controller: ProductController;
  let productService: {
    createProduct: jest.Mock;
    findAllForAdmin: jest.Mock;
    updateApprovalStatus: jest.Mock;
    updateInventoryStock: jest.Mock;
    reserveStockAtomic: jest.Mock;
    findApprovedProducts: jest.Mock;
    findEntityProducts: jest.Mock;
    updateProduct: jest.Mock;
    deleteProduct: jest.Mock;
    findById: jest.Mock;
  };

  const mockProductId = new Types.ObjectId('650000000000000000000050').toString();
  const mockEntityId = new Types.ObjectId('650000000000000000000020').toString();
  const mockUserId = new Types.ObjectId('650000000000000000000010').toString();
  const mockCategoryId = new Types.ObjectId('650000000000000000000030').toString();

  const mockUser = {
    id: mockUserId,
    sub: mockUserId,
    sellingEntityId: mockEntityId,
  };

  beforeEach(async () => {
    productService = {
      createProduct: jest.fn(),
      findAllForAdmin: jest.fn(),
      updateApprovalStatus: jest.fn(),
      updateInventoryStock: jest.fn(),
      reserveStockAtomic: jest.fn(),
      findApprovedProducts: jest.fn(),
      findEntityProducts: jest.fn(),
      updateProduct: jest.fn(),
      deleteProduct: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: productService,
        },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductController>(ProductController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createProduct', () => {
    it('should delegate to productService.createProduct with user context and dto', async () => {
      const dto: CreateProductDto = {
        title: 'New Phone',
        price: 999,
        categoryId: mockCategoryId,
      };
      const req = { user: mockUser };
      const serviceResponse = { success: true, data: { _id: mockProductId, ...dto } };
      productService.createProduct.mockResolvedValue(serviceResponse);

      const result = await controller.createProduct(dto, req);

      expect(productService.createProduct).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual(serviceResponse);
    });
  });

  describe('findAll', () => {
    it('should call productService.findAllForAdmin with status query', async () => {
      const products = [{ _id: mockProductId, title: 'Item 1' }];
      productService.findAllForAdmin.mockResolvedValue(products);

      const result = await controller.findAll('APPROVED', undefined);

      expect(productService.findAllForAdmin).toHaveBeenCalledWith('APPROVED');
      expect(result).toEqual(products);
    });
  });

  describe('findPending', () => {
    it('should call productService.findAllForAdmin with PENDING_APPROVAL status', async () => {
      const pending = [{ _id: mockProductId, approvalStatus: ProductApprovalStatusEnum.PENDING_APPROVAL }];
      productService.findAllForAdmin.mockResolvedValue(pending);

      const result = await controller.findPending();

      expect(productService.findAllForAdmin).toHaveBeenCalledWith(
        ProductApprovalStatusEnum.PENDING_APPROVAL,
      );
      expect(result).toEqual(pending);
    });
  });

  describe('getAllProducts', () => {
    it('should call productService.findAllForAdmin with no parameters', async () => {
      productService.findAllForAdmin.mockResolvedValue([]);

      const result = await controller.getAllProducts();

      expect(productService.findAllForAdmin).toHaveBeenCalledWith();
      expect(result).toEqual([]);
    });
  });

  describe('updateApprovalStatus', () => {
    it('should call productService.updateApprovalStatus', async () => {
      const dto: UpdateProductApprovalDto = {
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
      };
      const response = { success: true, message: 'Updated' };
      productService.updateApprovalStatus.mockResolvedValue(response);

      const result = await controller.updateApprovalStatus(mockProductId, dto);

      expect(productService.updateApprovalStatus).toHaveBeenCalledWith(mockProductId, dto);
      expect(result).toEqual(response);
    });
  });

  describe('approveProduct', () => {
    it('should approve product status via service', async () => {
      const response = { success: true, message: 'Approved' };
      productService.updateApprovalStatus.mockResolvedValue(response);

      const result = await controller.approveProduct(mockProductId);

      expect(productService.updateApprovalStatus).toHaveBeenCalledWith(mockProductId, {
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
      });
      expect(result).toEqual(response);
    });
  });

  describe('rejectProduct', () => {
    it('should reject product status with reason via service', async () => {
      const response = { success: true, message: 'Rejected' };
      productService.updateApprovalStatus.mockResolvedValue(response);

      const result = await controller.rejectProduct(mockProductId, 'Defective spec');

      expect(productService.updateApprovalStatus).toHaveBeenCalledWith(mockProductId, {
        approvalStatus: ProductApprovalStatusEnum.REJECTED,
        rejectionReason: 'Defective spec',
      });
      expect(result).toEqual(response);
    });
  });

  describe('updateInventoryStock', () => {
    it('should call productService.updateInventoryStock', async () => {
      const dto: UpdateInventoryDto = {
        sku: 'SKU-001',
        quantity: 10,
        operation: 'ADD',
      };
      const req = { user: mockUser };
      const response = { success: true };
      productService.updateInventoryStock.mockResolvedValue(response);

      const result = await controller.updateInventoryStock(dto, req);

      expect(productService.updateInventoryStock).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual(response);
    });
  });

  describe('reserveStockAtomic', () => {
    it('should reserve stock atomically via service', async () => {
      const response = { success: true };
      productService.reserveStockAtomic.mockResolvedValue(response);

      const result = await controller.reserveStockAtomic('SKU-001', 2);

      expect(productService.reserveStockAtomic).toHaveBeenCalledWith('SKU-001', 2);
      expect(result).toEqual(response);
    });
  });

  describe('findApprovedProducts', () => {
    it('should call productService.findApprovedProducts with categoryId', async () => {
      const products = [{ _id: mockProductId }];
      productService.findApprovedProducts.mockResolvedValue(products);

      const result = await controller.findApprovedProducts('cat_1');

      expect(productService.findApprovedProducts).toHaveBeenCalledWith('cat_1');
      expect(result).toEqual(products);
    });
  });

  describe('findEntityProducts', () => {
    it('should call productService.findEntityProducts with entity ID', async () => {
      const products = [{ _id: mockProductId, sellingEntityId: mockEntityId }];
      productService.findEntityProducts.mockResolvedValue(products);

      const result = await controller.findEntityProducts(mockEntityId);

      expect(productService.findEntityProducts).toHaveBeenCalledWith(mockEntityId);
      expect(result).toEqual(products);
    });
  });

  describe('updateProduct', () => {
    it('should call productService.updateProduct with id, dto, and user context', async () => {
      const dto: UpdateProductDto = { title: 'Updated Title' };
      const req = { user: mockUser };
      const response = { success: true };
      productService.updateProduct.mockResolvedValue(response);

      const result = await controller.updateProduct(mockProductId, dto, req);

      expect(productService.updateProduct).toHaveBeenCalledWith(mockProductId, dto, mockUser);
      expect(result).toEqual(response);
    });
  });

  describe('deleteProduct', () => {
    it('should call productService.deleteProduct with id and user context', async () => {
      const req = { user: mockUser };
      const response = { success: true, message: 'Deleted' };
      productService.deleteProduct.mockResolvedValue(response);

      const result = await controller.deleteProduct(mockProductId, req);

      expect(productService.deleteProduct).toHaveBeenCalledWith(mockProductId, mockUser);
      expect(result).toEqual(response);
    });
  });

  describe('findById', () => {
    it('should call productService.findById with product id', async () => {
      const product = { _id: mockProductId, title: 'Found Product' };
      productService.findById.mockResolvedValue(product);

      const result = await controller.findById(mockProductId);

      expect(productService.findById).toHaveBeenCalledWith(mockProductId);
      expect(result).toEqual(product);
    });
  });
});
