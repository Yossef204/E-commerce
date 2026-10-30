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

      brandFactory.createBrand.mockReturnValue(mockBrand);
      brandService.create.mockResolvedValue(mockBrand);

      const result = await controller.create(dto);

      expect(brandFactory.createBrand).toHaveBeenCalledWith(dto);
      expect(brandService.create).toHaveBeenCalledWith(mockBrand);
      expect(result).toEqual({
        message: 'Brand Created Successfully',
        success: true,
        data: mockBrand,
      });
    });
  });

  describe('findAll', () => {
    it('should return all brands', () => {
      brandService.findAll.mockReturnValue('This action returns all brand');

      const result = controller.findAll();

      expect(brandService.findAll).toHaveBeenCalled();
      expect(result).toBe('This action returns all brand');
    });
  });

  describe('findOne', () => {
    it('should return brand by numeric id', () => {
      brandService.findOne.mockReturnValue('This action returns a #1 brand');

      const result = controller.findOne('1');

      expect(brandService.findOne).toHaveBeenCalledWith(1);
      expect(result).toBe('This action returns a #1 brand');
    });
  });

  describe('update', () => {
    it('should update brand by numeric id', () => {
      const dto: UpdateBrandDto = {};
      brandService.update.mockReturnValue('This action updates a #1 brand');

      const result = controller.update('1', dto);

      expect(brandService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toBe('This action updates a #1 brand');
    });
  });

  describe('remove', () => {
    it('should remove brand by numeric id', () => {
      brandService.remove.mockReturnValue('This action removes a #1 brand');

      const result = controller.remove('1');

      expect(brandService.remove).toHaveBeenCalledWith(1);
      expect(result).toBe('This action removes a #1 brand');
    });
  });
});
