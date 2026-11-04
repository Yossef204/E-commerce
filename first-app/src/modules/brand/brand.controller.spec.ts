import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { BrandFactory } from './factory/brand.factory';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Brand } from './entities/brand.entity';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('BrandController', () => {
  let controller: BrandController;
  let brandService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let brandFactory: {
    createBrand: jest.Mock;
  };

  const mockBrandId = new Types.ObjectId('650000000000000000000010');
  const mockCategoryId = new Types.ObjectId('650000000000000000000020');

  const mockBrand: Brand & { _id: Types.ObjectId } = {
    _id: mockBrandId,
    name: 'sony',
    slug: 'sony',
    folderId: 'folder_sony',
    image: 'https://example.com/sony.png',
    categoryId: [mockCategoryId],
  };

  beforeEach(async () => {
    brandService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    brandFactory = {
      createBrand: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandController],
      providers: [
        {
          provide: BrandService,
          useValue: brandService,
        },
        {
          provide: BrandFactory,
          useValue: brandFactory,
        },
        { provide: JwtService, useValue: { verifyAsync: jest.fn(), verify: jest.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BrandController>(BrandController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should build brand via factory, call service.create and wrap response', async () => {
      const dto: CreateBrandDto = {
        name: 'Sony',
        folderId: 'folder_sony',
        image: 'https://example.com/sony.png',
        categoryId: [mockCategoryId.toString()],
      };
      const mockReq = { user: { role: 'admin', sellingEntityId: null } };

      brandFactory.createBrand.mockReturnValue(mockBrand);
      brandService.create.mockResolvedValue(mockBrand);

      const result = await controller.create(dto, mockReq);

      expect(brandFactory.createBrand).toHaveBeenCalledWith(dto, null);
      expect(brandService.create).toHaveBeenCalledWith(mockBrand, mockReq.user);
      expect(result).toEqual({
        message: 'Brand Created Successfully',
        success: true,
        data: mockBrand,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated brands list', async () => {
      const mockList = {
        success: true,
        data: [mockBrand],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      brandService.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll('1', '10', 'sony');

      expect(brandService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'sony',
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('findOne', () => {
    it('should return brand by valid ObjectId', async () => {
      brandService.findOne.mockResolvedValue(mockBrand);

      const result = await controller.findOne(mockBrandId.toString());

      expect(brandService.findOne).toHaveBeenCalledWith(mockBrandId.toString());
      expect(result).toEqual(mockBrand);
    });

    it('should throw BadRequestException on invalid ObjectId format', async () => {
      await expect(controller.findOne('invalid-id')).rejects.toThrow();
      expect(brandService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update brand by valid ObjectId', async () => {
      const dto: UpdateBrandDto = { name: 'Sony Updated' };
      const updatedBrand = { ...mockBrand, name: 'Sony Updated' };
      brandService.update.mockResolvedValue(updatedBrand);

      const result = await controller.update(mockBrandId.toString(), dto);

      expect(brandService.update).toHaveBeenCalledWith(
        mockBrandId.toString(),
        dto,
      );
      expect(result).toEqual(updatedBrand);
    });

    it('should throw BadRequestException on invalid ObjectId format', async () => {
      await expect(controller.update('bad-id', {})).rejects.toThrow();
      expect(brandService.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove brand by valid ObjectId', async () => {
      const deleteResult = {
        success: true,
        message: 'Brand deleted successfully',
      };
      brandService.remove.mockResolvedValue(deleteResult);

      const result = await controller.remove(mockBrandId.toString());

      expect(brandService.remove).toHaveBeenCalledWith(mockBrandId.toString());
      expect(result).toEqual(deleteResult);
    });

    it('should throw BadRequestException on invalid ObjectId format', async () => {
      await expect(controller.remove('bad-id')).rejects.toThrow();
      expect(brandService.remove).not.toHaveBeenCalled();
    });
  });
});
