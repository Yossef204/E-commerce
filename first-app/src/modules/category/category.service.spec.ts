import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CategoryService } from './category.service';
import { CategoryRepo } from '../../models/category/category.repository';
import { Category } from './entities/category.entity';

describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepo: {
    getOne: jest.Mock;
    getAll: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
    deleteOne: jest.Mock;
  };

  const mockCategoryId = new Types.ObjectId('650000000000000000000001');

  const mockCategory: Category & { _id: Types.ObjectId } = {
    _id: mockCategoryId,
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices and accessories',
    image: 'https://example.com/electronics.png',
    folderId: 'folder_123',
  };

  beforeEach(async () => {
    categoryRepo = {
      getOne: jest.fn(),
      getAll: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: CategoryRepo,
          useValue: categoryRepo,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a category if name does not exist', async () => {
      categoryRepo.getOne.mockResolvedValue(null);
      categoryRepo.create.mockResolvedValue(mockCategory);

      const result = await service.create(mockCategory);

      expect(categoryRepo.getOne).toHaveBeenCalledWith({
        name: mockCategory.name,
      });
      expect(categoryRepo.create).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual(mockCategory);
    });

    it('should throw ConflictException if category name already exists', async () => {
      categoryRepo.getOne.mockResolvedValue(mockCategory);

      await expect(service.create(mockCategory)).rejects.toThrow(
        ConflictException,
      );
      expect(categoryRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      categoryRepo.getAll.mockResolvedValue([mockCategory]);

      const result = await service.findAll();

      expect(categoryRepo.getAll).toHaveBeenCalledWith({});
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('findOne', () => {
    it('should return a category if found', async () => {
      categoryRepo.getOne.mockResolvedValue(mockCategory);

      const result = await service.findOne(mockCategoryId.toString());

      expect(categoryRepo.getOne).toHaveBeenCalledWith({
        _id: mockCategoryId.toString(),
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if category is not found', async () => {
      categoryRepo.getOne.mockResolvedValue(null);

      await expect(
        service.findOne(mockCategoryId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the category', async () => {
      const updatedCategory = { ...mockCategory, name: 'Home Electronics' };
      categoryRepo.updateOne.mockResolvedValue(updatedCategory);

      const result = await service.update(mockCategoryId.toString(), {
        name: 'Home Electronics',
      });

      expect(categoryRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockCategoryId.toString() },
        expect.objectContaining({
          name: 'Home Electronics',
          slug: 'home-electronics',
        }),
      );
      expect(result).toEqual(updatedCategory);
    });

    it('should throw NotFoundException if category to update is not found', async () => {
      categoryRepo.updateOne.mockResolvedValue(null);

      await expect(
        service.update(mockCategoryId.toString(), { name: 'Nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete and return success message with deleted category', async () => {
      categoryRepo.deleteOne.mockResolvedValue(mockCategory);

      const result = await service.remove(mockCategoryId.toString());

      expect(categoryRepo.deleteOne).toHaveBeenCalledWith({
        _id: mockCategoryId.toString(),
      });
      expect(result).toEqual({
        success: true,
        message: 'Category removed successfully',
        data: mockCategory,
      });
    });

    it('should throw NotFoundException if category to delete is not found', async () => {
      categoryRepo.deleteOne.mockResolvedValue(null);

      await expect(
        service.remove(mockCategoryId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
