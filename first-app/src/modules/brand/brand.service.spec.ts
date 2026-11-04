import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BrandService } from './brand.service';
import { BrandRepo } from '../../models/brand/brand.repository';
import { CategoryRepo } from '../../models/category/category.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { Brand } from './entities/brand.entity';

describe('BrandService', () => {
  let service: BrandService;
  let brandRepo: {
    getOne: jest.Mock;
    create: jest.Mock;
    getAll: jest.Mock;
    updateOne: jest.Mock;
    model: {
      find: jest.Mock;
      countDocuments: jest.Mock;
    };
  };
  let categoryRepo: {
    getAll: jest.Mock;
    getOne: jest.Mock;
  };
  let productRepo: {
    model: {
      countDocuments: jest.Mock;
    };
  };

  const mockBrandId = new Types.ObjectId('650000000000000000000010');
  const mockCategoryId1 = new Types.ObjectId('650000000000000000000020');
  const mockCategoryId2 = new Types.ObjectId('650000000000000000000021');

  const mockBrand: Brand & { _id: Types.ObjectId } = {
    _id: mockBrandId,
    name: 'apple',
    slug: 'apple',
    folderId: 'folder_brands',
    image: 'https://example.com/apple.png',
    categoryId: [mockCategoryId1, mockCategoryId2],
    isActive: true,
    isDeleted: false,
    deletedAt: null,
  };

  beforeEach(async () => {
    brandRepo = {
      getOne: jest.fn(),
      create: jest.fn(),
      getAll: jest.fn(),
      updateOne: jest.fn(),
      model: {
        find: jest.fn(),
        countDocuments: jest.fn(),
      },
    };

    categoryRepo = {
      getAll: jest.fn(),
      getOne: jest.fn(),
    };

    productRepo = {
      model: {
        countDocuments: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandService,
        {
          provide: BrandRepo,
          useValue: brandRepo,
        },
        {
          provide: CategoryRepo,
          useValue: categoryRepo,
        },
        {
          provide: ProductRepo,
          useValue: productRepo,
        },
      ],
    }).compile();

    service = module.get<BrandService>(BrandService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return brand when categories exist and brand name is unique', async () => {
      brandRepo.getOne.mockResolvedValue(null);
      categoryRepo.getAll.mockResolvedValue([
        { _id: mockCategoryId1 },
        { _id: mockCategoryId2 },
      ]);
      brandRepo.create.mockResolvedValue(mockBrand);

      const result = await service.create(mockBrand);

      expect(brandRepo.getOne).toHaveBeenCalled();
      expect(categoryRepo.getAll).toHaveBeenCalledWith({
        _id: { $in: mockBrand.categoryId },
      });
      expect(brandRepo.create).toHaveBeenCalledWith(mockBrand);
      expect(result).toEqual(mockBrand);
    });

    it('should throw NotFoundException if any specified category does not exist', async () => {
      brandRepo.getOne.mockResolvedValue(null);
      categoryRepo.getAll.mockResolvedValue([{ _id: mockCategoryId1 }]);

      await expect(service.create(mockBrand)).rejects.toThrow(
        NotFoundException,
      );
      expect(brandRepo.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if brand already exists', async () => {
      brandRepo.getOne.mockResolvedValue(mockBrand);

      await expect(service.create(mockBrand)).rejects.toThrow(
        ConflictException,
      );
      expect(brandRepo.create).not.toHaveBeenCalled();
    });

    it('should catch E11000 duplicate key error and throw ConflictException', async () => {
      brandRepo.getOne.mockResolvedValue(null);
      categoryRepo.getAll.mockResolvedValue([
        { _id: mockCategoryId1 },
        { _id: mockCategoryId2 },
      ]);
      const mongoError = new Error('E11000 duplicate key error collection');
      (mongoError as any).code = 11000;
      (mongoError as any).name = 'MongoServerError';
      brandRepo.create.mockRejectedValue(mongoError);

      await expect(service.create(mockBrand)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated brands list and metadata', async () => {
      const mockQueryChain = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockBrand]),
      };
      brandRepo.model.find.mockReturnValue(mockQueryChain);
      brandRepo.model.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({
        success: true,
        data: [mockBrand],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return brand by valid ObjectId', async () => {
      brandRepo.getOne.mockResolvedValue(mockBrand);

      const result = await service.findOne(mockBrandId.toString());

      expect(brandRepo.getOne).toHaveBeenCalledWith({
        _id: mockBrandId,
        isDeleted: { $ne: true },
      });
      expect(result).toEqual(mockBrand);
    });

    it('should throw BadRequestException if id format is invalid', async () => {
      await expect(service.findOne('invalid-hex-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if brand not found', async () => {
      brandRepo.getOne.mockResolvedValue(null);

      await expect(service.findOne(mockBrandId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return brand by valid id', async () => {
      brandRepo.getOne.mockResolvedValueOnce(mockBrand); // existence check
      brandRepo.getOne.mockResolvedValueOnce(null); // uniqueness check
      brandRepo.updateOne.mockResolvedValue({
        ...mockBrand,
        name: 'apple updated',
      });

      const result = await service.update(mockBrandId.toString(), {
        name: 'apple updated',
      });

      expect(brandRepo.updateOne).toHaveBeenCalled();
      expect(result.name).toBe('apple updated');
    });

    it('should throw BadRequestException on invalid id format', async () => {
      await expect(service.update('bad-id', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if updated name belongs to another brand', async () => {
      brandRepo.getOne.mockResolvedValueOnce(mockBrand); // existence check
      brandRepo.getOne.mockResolvedValueOnce({
        _id: new Types.ObjectId('650000000000000000000099'),
        name: 'other',
      }); // duplicate check

      await expect(
        service.update(mockBrandId.toString(), { name: 'other' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should soft delete brand if no active products are associated', async () => {
      brandRepo.getOne.mockResolvedValue(mockBrand);
      productRepo.model.countDocuments.mockResolvedValue(0);
      brandRepo.updateOne.mockResolvedValue({
        ...mockBrand,
        isDeleted: true,
        deletedAt: new Date(),
      });

      const result = await service.remove(mockBrandId.toString());

      expect(brandRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockBrandId },
        { $set: { isDeleted: true, deletedAt: expect.any(Date) } },
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Brand deleted successfully');
    });

    it('should throw ConflictException if active products are associated with the brand', async () => {
      brandRepo.getOne.mockResolvedValue(mockBrand);
      productRepo.model.countDocuments.mockResolvedValue(3);

      await expect(service.remove(mockBrandId.toString())).rejects.toThrow(
        ConflictException,
      );
      expect(brandRepo.updateOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if brand does not exist', async () => {
      brandRepo.getOne.mockResolvedValue(null);

      await expect(service.remove(mockBrandId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
