import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';

import { BrandController } from '../src/modules/brand/brand.controller';
import { BrandService } from '../src/modules/brand/brand.service';
import { BrandFactory } from '../src/modules/brand/factory/brand.factory';
import { BrandRepo } from '../src/models/brand/brand.repository';
import { CategoryRepo } from '../src/models/category/category.repository';
import { ProductRepo } from '../src/models/product/product.repository';
import { ProductService } from '../src/modules/product/product.service';
import { ProductFactory } from '../src/modules/product/factory/product.factory';
import { SellingEntityRepo } from '../src/models/selling-entity/selling-entity.repository';
import { UserRepo } from '../src/models/user/user.repository';
import { AuditLogInterceptor } from '../src/common/interceptors/audit-log.interceptor';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditLogRepo } from '../src/models/audit-log/audit-log.repository';
import { AuditActionEnum } from '../src/common/enums/audit-action.enum';
import { RolesEnum } from '../src/common/enums/roles';

import { InventoryRepo } from '../src/models/inventory/inventory.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AuthenticationGuard } from '../src/common/guards/authentication.guard';

import { EntityStatusEnum } from '../src/common/enums/entity-status.enum';

describe('Brand Remediation E2E Verification', () => {
  let brandController: BrandController;
  let brandService: BrandService;
  let productService: ProductService;
  let interceptor: AuditLogInterceptor;
  let reflector: Reflector;

  // In-memory mock database collections
  const brandsDb = new Map<string, any>();
  const productsDb = new Map<string, any>();
  const categoriesDb = new Map<string, any>();
  const auditLogsDb: any[] = [];

  const mockAdminId = new Types.ObjectId('6abaa7508528c65b5d341a95');
  const mockSellerEntityA = new Types.ObjectId('6abaa7508528c65b5d341a11');
  const mockSellerEntityB = new Types.ObjectId('6abaa7508528c65b5d341a22');
  const mockCategoryId = new Types.ObjectId('6ab2c7bef84808feea26dd6d');

  beforeAll(async () => {
    // Preload mock category
    categoriesDb.set(mockCategoryId.toString(), {
      _id: mockCategoryId,
      name: 'Electronics',
      slug: 'electronics',
    });

    const mockBrandRepo = {
      model: {
        find: jest.fn().mockImplementation((filter: any) => {
          let list = Array.from(brandsDb.values());
          if (filter?.isDeleted?.$ne) {
            list = list.filter((b) => !b.isDeleted);
          }
          if (filter?.name?.$regex) {
            list = list.filter((b) => filter.name.$regex.test(b.name));
          }
          return {
            skip: () => ({
              limit: () => ({
                sort: () => ({
                  lean: () => ({
                    exec: async () => list,
                  }),
                }),
              }),
            }),
          };
        }),
        countDocuments: jest.fn().mockImplementation((filter: any) => {
          let list = Array.from(brandsDb.values());
          if (filter?.isDeleted?.$ne) {
            list = list.filter((b) => !b.isDeleted);
          }
          return {
            exec: async () => list.length,
          };
        }),
      },
      create: jest.fn().mockImplementation(async (data: any) => {
        // Enforce uniqueness constraint emulation
        const nameLower = (data.name || '').toLowerCase();
        for (const existing of brandsDb.values()) {
          if (!existing.isDeleted && existing.name.toLowerCase() === nameLower) {
            const err: any = new Error(
              `E11000 duplicate key error collection: Ecommerce.brands index: name_1 dup key: { name: "${data.name}" }`,
            );
            err.code = 11000;
            err.name = 'MongoServerError';
            throw err;
          }
        }
        const doc = {
          _id: new Types.ObjectId(),
          ...data,
          toObject: function () {
            const { toObject, ...rest } = this;
            return rest;
          },
        };
        brandsDb.set(doc._id.toString(), doc);
        return doc;
      }),
      getOne: jest.fn().mockImplementation(async (filter: any) => {
        for (const item of brandsDb.values()) {
          if (filter._id && filter._id.toString() !== item._id.toString()) continue;
          if (
            filter._id?.$ne &&
            filter._id.$ne.toString() === item._id.toString()
          )
            continue;
          if (filter.isDeleted?.$ne && item.isDeleted) continue;
          if (filter.name) {
            if (filter.name instanceof RegExp) {
              if (!filter.name.test(item.name)) continue;
            } else if (filter.name.$regex) {
              if (!filter.name.$regex.test(item.name)) continue;
            } else if (filter.name !== item.name) {
              continue;
            }
          }
          return {
            ...item,
            toObject: function () {
              const { toObject, ...rest } = this;
              return rest;
            },
          };
        }
        return null;
      }),
      updateOne: jest.fn().mockImplementation(async (filter: any, update: any) => {
        const id = filter._id?.toString();
        const existing = brandsDb.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...(update.$set || update) };
        updated.toObject = function () {
          const { toObject, ...rest } = this;
          return rest;
        };
        brandsDb.set(id, updated);
        return updated;
      }),
    };

    const mockCategoryRepo = {
      getAll: jest.fn().mockImplementation(async (filter: any) => {
        if (filter?._id?.$in) {
          const ids = filter._id.$in.map((i: any) => i.toString());
          return Array.from(categoriesDb.values()).filter((c) =>
            ids.includes(c._id.toString()),
          );
        }
        return Array.from(categoriesDb.values());
      }),
      getOne: jest.fn().mockImplementation(async (filter: any) => {
        return categoriesDb.get(filter._id?.toString()) || null;
      }),
    };

    const mockProductRepo = {
      model: {
        countDocuments: jest.fn().mockImplementation(async (filter: any) => {
          let count = 0;
          for (const p of productsDb.values()) {
            if (
              filter.brandId &&
              p.brandId?.toString() === filter.brandId.toString() &&
              (!filter.isDeleted?.$ne || !p.isDeleted)
            ) {
              count++;
            }
          }
          return count;
        }),
      },
      create: jest.fn().mockImplementation(async (data: any) => {
        const doc = { _id: new Types.ObjectId(), ...data };
        productsDb.set(doc._id.toString(), doc);
        return doc;
      }),
      getOne: jest.fn().mockImplementation(async (filter: any) => {
        for (const p of productsDb.values()) {
          if (filter._id && filter._id.toString() !== p._id.toString()) continue;
          return p;
        }
        return null;
      }),
      updateOne: jest.fn().mockImplementation(async (filter: any, update: any) => {
        const id = filter._id?.toString();
        const existing = productsDb.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...(update.$set || update) };
        productsDb.set(id, updated);
        return updated;
      }),
    };

    const mockAuditLogRepo = {
      create: jest.fn().mockImplementation(async (data: any) => {
        const log = { _id: new Types.ObjectId(), ...data, createdAt: new Date() };
        auditLogsDb.push(log);
        return log;
      }),
      getAll: jest.fn().mockImplementation(async (filter: any) => {
        return auditLogsDb.filter((l) => {
          if (filter.targetEntity && l.targetEntity !== filter.targetEntity) return false;
          if (filter.targetId && l.targetId !== filter.targetId) return false;
          return true;
        });
      }),
    };

    const mockSellingEntityRepo = {
      getOne: jest.fn().mockImplementation(async (filter: any) => {
        return {
          _id: filter._id,
          legalName: 'Merchant Entity Inc',
          verificationStatus: 'approved',
          status: EntityStatusEnum.APPROVED,
        };
      }),
    };

    const mockUserRepo = {
      getOne: jest.fn().mockResolvedValue({
        _id: mockAdminId,
        role: RolesEnum.SUPER_ADMIN,
        sellingEntityId: null,
      }),
    };

    const mockInventoryRepo = {
      model: {
        findOne: jest.fn().mockResolvedValue(null),
      },
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandService,
        BrandFactory,
        BrandController,
        ProductService,
        ProductFactory,
        AuditService,
        AuditLogInterceptor,
        Reflector,
        { provide: BrandRepo, useValue: mockBrandRepo },
        { provide: CategoryRepo, useValue: mockCategoryRepo },
        { provide: ProductRepo, useValue: mockProductRepo },
        { provide: InventoryRepo, useValue: mockInventoryRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: AuditLogRepo, useValue: mockAuditLogRepo },
        { provide: SellingEntityRepo, useValue: mockSellingEntityRepo },
        { provide: UserRepo, useValue: mockUserRepo },
      ],
    })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    brandController = module.get<BrandController>(BrandController);
    brandService = module.get<BrandService>(BrandService);
    productService = module.get<ProductService>(ProductService);
    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('TASK 1: AuditLogInterceptor Recursion & Serialization', () => {
    it('should successfully record audit log without RangeError on Brand CREATE returning Mongoose-like doc', async () => {
      const mockReq = {
        user: { id: mockAdminId.toString(), role: RolesEnum.SUPER_ADMIN },
        body: {
          name: 'AuditBrandTest',
          categoryId: [mockCategoryId.toString()],
        },
        ip: '127.0.0.1',
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        targetEntity: 'Brand',
        action: AuditActionEnum.CREATE,
      });

      const response = await brandController.create(
        {
          name: 'AuditBrandTest',
          categoryId: [mockCategoryId.toString()],
        },
        mockReq,
      );

      expect(response.success).toBe(true);
      expect(response.data._id).toBeDefined();

      // Intercept the execution
      const callHandler = { handle: () => of(response) };
      const execContext: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => ({}),
        }),
      };

      await new Promise<void>((resolve, reject) => {
        interceptor.intercept(execContext, callHandler).subscribe({
          next: async () => {
            // Give tap operator microtask a moment to persist
            await new Promise((r) => setTimeout(r, 10));
            const auditEntry = auditLogsDb.find(
              (l) =>
                l.targetEntity === 'Brand' &&
                l.action === AuditActionEnum.CREATE,
            );
            expect(auditEntry).toBeDefined();
            expect(auditEntry.actorId.toString()).toBe(mockAdminId.toString());
            expect(auditEntry.targetId).toBe(response.data._id.toString());
            expect(auditEntry.newState).toBeDefined();
            expect(auditEntry.newState.name).toBe('AuditBrandTest');
            resolve();
          },
          error: (err) => reject(err),
        });
      });
    });
  });

  describe('TASK 2: Real Brand CRUD & ID Handling', () => {
    let testBrandId: string;

    it('should create a brand and persist in database', async () => {
      const mockReq = { user: { role: RolesEnum.SUPER_ADMIN, sellingEntityId: null } };
      const result = await brandController.create(
        {
          name: 'Puma',
          categoryId: [mockCategoryId.toString()],
        },
        mockReq,
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Puma');
      expect(result.data.isDeleted).toBe(false);
      testBrandId = result.data._id.toString();
    });

    it('should list all brands with pagination and exclude soft-deleted records', async () => {
      const list = await brandController.findAll('1', '10');
      expect(list.success).toBe(true);
      expect(list.data.length).toBeGreaterThanOrEqual(1);
      expect(list.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve a brand by valid ObjectId', async () => {
      const brand = await brandController.findOne(testBrandId);
      expect(brand).toBeDefined();
      expect(brand._id.toString()).toBe(testBrandId);
    });

    it('should throw BadRequestException on malformed ObjectId', async () => {
      await expect(brandController.findOne('123-not-valid')).rejects.toThrow(
        BadRequestException,
      );
      await expect(brandController.update('123-not-valid', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(brandController.remove('123-not-valid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update brand details and slugify updated name', async () => {
      const updated = await brandController.update(testBrandId, {
        name: 'Puma Updated',
      });
      expect(updated.name).toBe('Puma Updated');
      expect(updated.slug).toBe('puma-updated');
    });

    it('should prevent deletion of brand when active products are linked', async () => {
      // Link a product to this brand
      productsDb.set('prod_linked_1', {
        _id: new Types.ObjectId(),
        title: 'Puma Running Shoes',
        brandId: new Types.ObjectId(testBrandId),
        isDeleted: false,
      });

      await expect(brandController.remove(testBrandId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should soft delete brand after product is unlinked or removed', async () => {
      // Remove product link
      productsDb.delete('prod_linked_1');

      const deleteRes = await brandController.remove(testBrandId);
      expect(deleteRes.success).toBe(true);
      expect(deleteRes.message).toBe('Brand deleted successfully');

      // Verify soft-deleted state
      const brandInDb = brandsDb.get(testBrandId);
      expect(brandInDb.isDeleted).toBe(true);
      expect(brandInDb.deletedAt).toBeInstanceOf(Date);

      // Verify findOne throws NotFoundException on soft-deleted brand
      await expect(brandController.findOne(testBrandId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('TASK 4: Concurrency & Duplicate Key 11000 Handling', () => {
    it('should handle 8 concurrent requests: exactly 1 creates (201) and others receive 409 Conflict with 0 server errors (500)', async () => {
      const mockReq = { user: { role: RolesEnum.SUPER_ADMIN, sellingEntityId: null } };
      const brandDto = {
        name: 'ConcurrentStressBrand',
        categoryId: [mockCategoryId.toString()],
      };

      const promises = Array.from({ length: 8 }, () =>
        brandController
          .create(brandDto, mockReq)
          .then((res) => ({ status: 201, res }))
          .catch((err) => ({
            status: err instanceof ConflictException ? 409 : 500,
            err,
          })),
      );

      const results = await Promise.all(promises);

      const createdCount = results.filter((r) => r.status === 201).length;
      const conflictCount = results.filter((r) => r.status === 409).length;
      const serverErrorCount = results.filter((r) => r.status === 500).length;

      expect(createdCount).toBe(1);
      expect(conflictCount).toBe(7);
      expect(serverErrorCount).toBe(0);
    });
  });

  describe('TASK 5: Platform Global vs. Entity-Owned Brands', () => {
    let globalBrandId: string;
    let sellerBBrandId: string;

    it('admin creates brand with sellingEntityId = null (Platform Global)', async () => {
      const mockReq = { user: { role: RolesEnum.SUPER_ADMIN, sellingEntityId: null } };
      const res = await brandController.create(
        {
          name: 'Platform Global Brand',
          categoryId: [mockCategoryId.toString()],
        },
        mockReq,
      );

      expect(res.data.sellingEntityId).toBeNull();
      globalBrandId = res.data._id.toString();
    });

    it('seller creates private brand linked to their sellingEntityId', async () => {
      const mockSellerReq = {
        user: {
          role: RolesEnum.SELLER,
          sellingEntityId: mockSellerEntityB,
        },
      };
      const res = await brandController.create(
        {
          name: 'Seller B Private Brand',
          categoryId: [mockCategoryId.toString()],
        },
        mockSellerReq,
      );

      expect(res.data.sellingEntityId.toString()).toBe(
        mockSellerEntityB.toString(),
      );
      sellerBBrandId = res.data._id.toString();
    });

    it('ProductService allows Seller A to attach Platform Global Brand (sellingEntityId = null)', async () => {
      const createProductDto: any = {
        title: 'Product on Global Brand',
        categoryId: mockCategoryId.toString(),
        brandId: globalBrandId,
        variants: [{ sku: 'SKU-GLOB-1', price: 100 }],
      };

      const userContext = {
        id: new Types.ObjectId().toString(),
        sellingEntityId: mockSellerEntityA.toString(),
        role: RolesEnum.SELLER,
      };

      const result = await productService.createProduct(
        userContext,
        createProductDto,
      );

      expect(result).toBeDefined();
      expect(result.data.brandId.toString()).toBe(globalBrandId);
    });

    it('ProductService forbids Seller A from attaching Seller B Private Brand', async () => {
      const createProductDto: any = {
        title: 'Product Hijacking Brand',
        categoryId: mockCategoryId.toString(),
        brandId: sellerBBrandId,
        variants: [{ sku: 'SKU-HIJACK-1', price: 100 }],
      };

      const userContext = {
        id: new Types.ObjectId().toString(),
        sellingEntityId: mockSellerEntityA.toString(),
        role: RolesEnum.SELLER,
      };

      await expect(
        productService.createProduct(userContext, createProductDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
