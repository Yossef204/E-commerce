import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CategoryFactory } from './factory/category.factory';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

describe('CategoryController', () => {
  let controller: CategoryController;
  let categoryService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let categoryFactory: {
    createCategory: jest.Mock;
    updateCategory: jest.Mock;
  };

  const mockCategoryId = new Types.ObjectId('650000000000000000000001');

  const mockCategory: Category & { _id: Types.ObjectId } = {
    _id: mockCategoryId,
    name: 'Electronics',
    slug: 'electronics',
    description: 'All gadgets',
    image: 'https://example.com/gadgets.png',
    folderId: 'folder_abc',
  };

  beforeEach(async () => {
    categoryService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    categoryFactory = {
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: categoryService,
        },
        {
          provide: CategoryFactory,
          useValue: categoryFactory,
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

    controller = module.get<CategoryController>(CategoryController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should convert dto via factory and call service.create', async () => {
      const dto: CreateCategoryDto = {
        name: 'Electronics',
        description: 'All gadgets',
        image: 'https://example.com/gadgets.png',
        folderId: 'folder_abc',
      };

      categoryFactory.createCategory.mockReturnValue(mockCategory);
      categoryService.create.mockResolvedValue(mockCategory);

      const result = await controller.create(dto);

      expect(categoryFactory.createCategory).toHaveBeenCalledWith(dto);
      expect(categoryService.create).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual({
        message: 'Category Created Successfully',
        success: true,
        data: mockCategory,
      });
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      categoryService.findAll.mockResolvedValue([mockCategory]);

      const result = await controller.findAll();

      expect(categoryService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('findOne', () => {
    it('should return a single category by id', async () => {
      categoryService.findOne.mockResolvedValue(mockCategory);

      const result = await controller.findOne(mockCategoryId.toString());

      expect(categoryService.findOne).toHaveBeenCalledWith(
        mockCategoryId.toString(),
      );
      expect(result).toEqual(mockCategory);
    });
  });

  describe('update', () => {
    it('should update category and return success response', async () => {
      const dto: UpdateCategoryDto = { name: 'Smart Electronics' };
      const updatedCategory = { ...mockCategory, name: 'Smart Electronics' };
      categoryService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update(mockCategoryId.toString(), dto);

      expect(categoryService.update).toHaveBeenCalledWith(
        mockCategoryId.toString(),
        dto,
      );
      expect(result).toEqual({
        message: 'Category Updated Successfully',
        success: true,
        data: updatedCategory,
      });
    });
  });

  describe('remove', () => {
    it('should remove category by id', async () => {
      const deleteResult = {
        success: true,
        message: 'Category removed successfully',
        data: mockCategory,
      };
      categoryService.remove.mockResolvedValue(deleteResult);

      const result = await controller.remove(mockCategoryId.toString());

      expect(categoryService.remove).toHaveBeenCalledWith(
        mockCategoryId.toString(),
      );
      expect(result).toEqual(deleteResult);
    });
  });
});
