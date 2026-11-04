import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default || supertest;
import { AppModule } from '../src/app.module';
import { Connection, Types } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import * as jwt from 'jsonwebtoken';
import { RolesEnum } from '../src/common/enums/roles';
import { ConfigService } from '@nestjs/config';

jest.setTimeout(45000);

describe('Brands Module Phase 2 — Real Integration & E2E Tests (Supertest + MongoDB)', () => {
  let app: INestApplication;
  let connection: Connection;
  let jwtSecret: string;

  // Disposable tracking manifest for exact cleanup
  const createdBrandIds: Types.ObjectId[] = [];
  const createdProductIds: Types.ObjectId[] = [];

  // Real entity references from MongoDB Atlas
  const VALID_CATEGORY_ID = '6ab2c7bef84808feea26dd6d'; // Electronics
  const SELLER_A_ENTITY_ID = '6abac731cfd5b2ef7df27056'; // Adidas (ACTIVE)
  const SELLER_A_USER_ID = '6abac730cfd5b2ef7df27055';
  const SELLER_B_ENTITY_ID = '6ac13a540b875416f269ac99'; // Nike (ACTIVE)
  const SELLER_B_USER_ID = '6ac11ecd52cd31d4641d82d0';
  const SUPER_ADMIN_USER_ID = '6abaa7508528c65b5d341a95';

  let superAdminToken: string;
  let sellerAToken: string;
  let sellerBToken: string;
  let companyAdminToken: string; // Company admin without brand.manage.all

  const generateToken = (payload: {
    userId: string;
    role: string;
    sellingEntityId?: string | null;
    permissions?: string[];
  }) => {
    return jwt.sign(
      {
        id: payload.userId,
        sub: payload.userId,
        userId: payload.userId,
        role: payload.role,
        sellingEntityId: payload.sellingEntityId || null,
        tokenType: 'access',
        tokenVersion: 1,
        permissions: payload.permissions || [],
      },
      jwtSecret,
      { expiresIn: '1h' },
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    const configService = app.get<ConfigService>(ConfigService);
    jwtSecret =
      configService.get<string>('JWT_SECRET') ||
      process.env.ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      'default_jwt_secret_fallback';

    superAdminToken = generateToken({
      userId: SUPER_ADMIN_USER_ID,
      role: RolesEnum.SUPER_ADMIN,
    });

    sellerAToken = generateToken({
      userId: SELLER_A_USER_ID,
      role: RolesEnum.SELLER,
      sellingEntityId: SELLER_A_ENTITY_ID,
    });

    sellerBToken = generateToken({
      userId: SELLER_B_USER_ID,
      role: RolesEnum.SELLER,
      sellingEntityId: SELLER_B_ENTITY_ID,
    });

    // Seller A user acting as company admin (without brand.manage.all)
    companyAdminToken = generateToken({
      userId: SELLER_A_USER_ID,
      role: RolesEnum.COMPANY_ADMIN,
      sellingEntityId: SELLER_A_ENTITY_ID,
    });
  }, 60000);

  afterAll(async () => {
    try {
      if (connection) {
        if (createdBrandIds.length > 0) {
          await connection.collection('brands').deleteMany({
            _id: { $in: createdBrandIds },
          });
        }
        if (createdProductIds.length > 0) {
          await connection.collection('products').deleteMany({
            _id: { $in: createdProductIds },
          });
        }
      }
    } catch (cleanupErr) {
      console.warn('Test cleanup notice:', cleanupErr);
    } finally {
      if (app) {
        await app.close();
      }
    }
  }, 30000);

  describe('1. Partial Unique Index & Soft-Delete Re-Registration', () => {
    it('should successfully recreate a brand with the exact same name after soft deletion (201 Created)', async () => {
      const brandName = `recreate_test_${Date.now()}`;

      // 1. Initial creation
      const resCreate1 = await request(app.getHttpServer())
        .post('/brand')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: brandName,
          categoryId: [VALID_CATEGORY_ID],
        })
        .expect(201);

      const brandId1 = resCreate1.body.data._id;
      createdBrandIds.push(new Types.ObjectId(brandId1));
      expect(resCreate1.body.data.name).toBe(brandName);
      expect(resCreate1.body.data.isDeleted).toBe(false);

      // 2. Soft delete the brand
      const resDelete = await request(app.getHttpServer())
        .delete(`/brand/${brandId1}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(resDelete.body.data.isDeleted).toBe(true);

      // Verify in DB directly
      const dbDoc1 = await connection.collection('brands').findOne({
        _id: new Types.ObjectId(brandId1),
      });
      expect(dbDoc1?.isDeleted).toBe(true);

      // 3. Re-create brand with the same name -> Must succeed with 201 Created (Partial Index verification)
      const resCreate2 = await request(app.getHttpServer())
        .post('/brand')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: brandName,
          categoryId: [VALID_CATEGORY_ID],
        })
        .expect(201);

      const brandId2 = resCreate2.body.data._id;
      createdBrandIds.push(new Types.ObjectId(brandId2));
      expect(brandId2).not.toBe(brandId1);
      expect(resCreate2.body.data.name).toBe(brandName);
      expect(resCreate2.body.data.isDeleted).toBe(false);
    });
  });

  describe('2. Seller Dual-Tenancy: Private Brand Creation', () => {
    it("should allow Seller to create brand and automatically bind seller's sellingEntityId", async () => {
      const sellerBrandName = `seller_a_brand_${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post('/brand')
        .set('Authorization', `Bearer ${sellerAToken}`)
        .send({
          name: sellerBrandName,
          categoryId: [VALID_CATEGORY_ID],
        })
        .expect(201);

      const createdId = res.body.data._id;
      createdBrandIds.push(new Types.ObjectId(createdId));

      expect(res.body.data.name).toBe(sellerBrandName);
      expect(res.body.data.sellingEntityId).toBe(SELLER_A_ENTITY_ID);

      // Verify MongoDB persistence
      const dbDoc = await connection.collection('brands').findOne({
        _id: new Types.ObjectId(createdId),
      });
      expect(dbDoc?.sellingEntityId?.toString()).toBe(SELLER_A_ENTITY_ID);
    });
  });

  describe('3. Multi-Tenant Mutation Ownership (Cross-Tenant Isolation)', () => {
    let sellerBBrandId: string;

    beforeAll(async () => {
      // Create brand belonging to Seller B
      const brandBName = `seller_b_private_${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/brand')
        .set('Authorization', `Bearer ${sellerBToken}`)
        .send({
          name: brandBName,
          categoryId: [VALID_CATEGORY_ID],
        })
        .expect(201);

      sellerBBrandId = res.body.data._id;
      createdBrandIds.push(new Types.ObjectId(sellerBBrandId));
    });

    it("should reject Seller A attempting to PATCH Seller B's brand (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/brand/${sellerBBrandId}`)
        .set('Authorization', `Bearer ${sellerAToken}`)
        .send({
          name: `hacked_by_seller_a_${Date.now()}`,
        })
        .expect(403);

      expect(res.body.message).toContain(
        'You do not have permission to modify another tenant brand',
      );
    });

    it("should reject Seller A attempting to DELETE Seller B's brand (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/brand/${sellerBBrandId}`)
        .set('Authorization', `Bearer ${sellerAToken}`)
        .expect(403);

      expect(res.body.message).toContain(
        'You do not have permission to modify another tenant brand',
      );
    });

    it("should allow Seller B to successfully update their own brand (200 OK)", async () => {
      const updatedName = `seller_b_updated_${Date.now()}`;
      const res = await request(app.getHttpServer())
        .patch(`/brand/${sellerBBrandId}`)
        .set('Authorization', `Bearer ${sellerBToken}`)
        .send({
          name: updatedName,
        })
        .expect(200);

      expect(res.body.name).toBe(updatedName);
    });
  });

  describe('4. Global Brand Protection against Non-Platform Admins', () => {
    let globalBrandId: string;

    beforeAll(async () => {
      const globalBrandName = `platform_global_${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/brand')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: globalBrandName,
          categoryId: [VALID_CATEGORY_ID],
        })
        .expect(201);

      globalBrandId = res.body.data._id;
      createdBrandIds.push(new Types.ObjectId(globalBrandId));
      expect(res.body.data.sellingEntityId).toBeNull();
    });

    it('should reject Company Admin without brand.manage.all modifying a Global Brand (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/brand/${globalBrandId}`)
        .set('Authorization', `Bearer ${companyAdminToken}`)
        .send({
          name: `tampered_global_${Date.now()}`,
        })
        .expect(403);

      expect(res.body.message).toContain(
        'You do not have permission to modify a global platform brand',
      );
    });

    it('should reject Company Admin without brand.manage.all deleting a Global Brand (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/brand/${globalBrandId}`)
        .set('Authorization', `Bearer ${companyAdminToken}`)
        .expect(403);

      expect(res.body.message).toContain(
        'You do not have permission to modify a global platform brand',
      );
    });

    it('should allow Super Admin to modify a Global Brand (200 OK)', async () => {
      const updatedGlobalName = `platform_global_upd_${Date.now()}`;
      const res = await request(app.getHttpServer())
        .patch(`/brand/${globalBrandId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: updatedGlobalName,
        })
        .expect(200);

      expect(res.body.name).toBe(updatedGlobalName);
    });
  });

  describe('5. Cross-Tenant Product Link Validation', () => {
    let sellerBBrandId: string;

    beforeAll(async () => {
      const brandBName = `seller_b_prod_brand_${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/brand')
        .set('Authorization', `Bearer ${sellerBToken}`)
        .send({
          name: brandBName,
          categoryId: [VALID_CATEGORY_ID],
        })
        .expect(201);

      sellerBBrandId = res.body.data._id;
      createdBrandIds.push(new Types.ObjectId(sellerBBrandId));
    });

    it("should reject Seller A creating a product with Seller B's private brand (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${sellerAToken}`)
        .send({
          title: `SellerA Product Cross Test ${Date.now()}`,
          desc: 'A product attempting cross-tenant brand linkage',
          categoryId: VALID_CATEGORY_ID,
          brandId: sellerBBrandId,
          variants: [
            {
              sku: `SKU_CROSS_${Date.now()}`,
              price: 100,
              initialStock: 10,
              attributes: { color: 'Blue' },
            },
          ],
        })
        .expect(403);

      expect(res.body.message).toContain(
        'Specified brand does not belong to your selling entity',
      );
    });
  });
});
