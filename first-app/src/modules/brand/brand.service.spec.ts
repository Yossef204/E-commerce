import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BrandService } from './brand.service';
import { BrandRepo } from '../../models/brand/brand.repository';
import { CategoryRepo } from '../../models/category/category.repository';
import { Brand } from './entities/brand.entity';

describe('BrandService', () => {
  let service: BrandService;
  let brandRepo: {
    getOne: jest.Mock;
    create: jest.Mock;
    getAll: jest.Mock;
  };
  let categoryRepo: {
    getAll: jest.Mock;
    getOne: jest.Mock;
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
  };

  beforeEach(async () => {
    brandRepo = {
      getOne: jest.fn(),
      create: jest.fn(),
      getAll: jest.fn(),
    };

    categoryRepo = {
      getAll: jest.fn(),
      getOne: jest.fn(),
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

      expect(brandRepo.getOne).toHaveBeenCalledWith({ name: mockBrand.name });
      expect(categoryRepo.getAll).toHaveBeenCalledWith({
        _id: { $in: mockBrand.categoryId },
      });
      expect(brandRepo.create).toHaveBeenCalledWith(mockBrand);
      expect(result).toEqual(mockBrand);
    });

    it('should throw NotFoundException if any specified category does not exist', async () => {
      brandRepo.getOne.mockResolvedValue(null);
      // Only 1 category found out of 2 requested
      categoryRepo.getAll.mockResolvedValue([{ _id: mockCategoryId1 }]);

      await expect(service.create(mockBrand)).rejects.toThrow(
        NotFoundException,
      );
      expect(brandRepo.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if brand already exists', async () => {
      brandRepo.getOne.mockResolvedValue(mockBrand);
      categoryRepo.getAll.mockResolvedValue([
        { _id: mockCategoryId1 },
        { _id: mockCategoryId2 },
      ]);

      await expect(service.create(mockBrand)).rejects.toThrow(
        ConflictException,
      );
      expect(brandRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all brand message string', () => {
      expect(service.findAll()).toBe('This action returns all brand');
    });
  });

  describe('findOne', () => {
    it('should return brand by id message string', () => {
      expect(service.findOne(5)).toBe('This action returns a #5 brand');
    });
  });

  describe('update', () => {
    it('should return update brand message string', () => {
      expect(service.update(5, {})).toBe('This action updates a #5 brand');
    });
  });

  describe('remove', () => {
    it('should return remove brand message string', () => {
      expect(service.remove(5)).toBe('This action removes a #5 brand');
    });
  });
});
