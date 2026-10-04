import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserRepo } from '../models/user/user.repository';
import { SellerRepo } from '../models/seller/seller.repository';
import { SellingEntityRepo } from '../models/selling-entity/selling-entity.repository';
import { PermissionRepo } from '../models/permission/permission.repository';
import { RolesEnum } from '../common/enums/roles';
import { AccountStatusEnum } from '../common/enums/account-status';
import { EntityTypeEnum } from '../common/enums/entity-type.enum';
import { EntityStatusEnum } from '../common/enums/entity-status.enum';
import { DEFAULT_COMPANY_ADMIN_PERMISSIONS } from '../common/enums/default-role-permissions';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  console.log('🚀 Starting Pending Brand & Brand Admin Seeding...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const userRepo = app.get(UserRepo);
    const sellerRepo = app.get(SellerRepo);
    const sellingEntityRepo = app.get(SellingEntityRepo);
    const permissionRepo = app.get(PermissionRepo);
    const connection = app.get<Connection>(getConnectionToken());

    const dbName = connection?.db?.databaseName || 'Unknown DB';
    const email = 'ymo22161@gmail.com';
    const rawPassword = 'Yossef@mo11';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 1. Create or update Brand Admin User (Seller)
    let sellerUser = await userRepo.getOne({ email: email.toLowerCase() });

    if (sellerUser) {
      console.log(`ℹ️ Brand Admin User "${email}" already exists. Updating credentials and status...`);
      await userRepo.updateOne(
        { _id: sellerUser._id },
        {
          userName: 'Adidas Admin',
          password: hashedPassword,
          role: RolesEnum.COMPANY_ADMIN,
          status: AccountStatusEnum.PENDING_VERIFICATION,
          isEmailVerified: true,
        },
      );
      sellerUser = await userRepo.getOne({ email: email.toLowerCase() });
    } else {
      console.log(`✨ Creating Brand Admin User "${email}" via SellerRepo...`);
      sellerUser = await sellerRepo.create({
        userName: 'Adidas Admin',
        email: email.toLowerCase(),
        phoneNumber: '+201000000001',
        password: hashedPassword,
        role: RolesEnum.COMPANY_ADMIN,
        status: AccountStatusEnum.PENDING_VERIFICATION,
        isEmailVerified: true,
      } as any);
    }

    const userId = sellerUser?._id ? sellerUser._id.toString() : (sellerUser as any)?.id;

    // 2. Create or update Pending Brand Entity ("Adidas")
    const brandName = 'Adidas';
    let sellingEntity = await sellingEntityRepo.getOne({ legalName: brandName });

    if (sellingEntity) {
      console.log(`ℹ️ Selling Entity "${brandName}" already exists. Updating status to PENDING_APPROVAL...`);
      await sellingEntityRepo.updateOne(
        { _id: sellingEntity._id },
        {
          type: EntityTypeEnum.BRAND,
          status: EntityStatusEnum.PENDING_APPROVAL,
          primaryOwnerId: sellerUser._id,
          businessDetails: {
            phone: '+201000000001',
            address: 'Adidas HQ, Cairo',
            taxNumber: 'TAX-ADD-10',
          },
        },
      );
      sellingEntity = await sellingEntityRepo.getOne({ legalName: brandName });
    } else {
      console.log(`✨ Creating new Pending Selling Entity "${brandName}"...`);
      sellingEntity = await sellingEntityRepo.create({
        legalName: brandName,
        type: EntityTypeEnum.BRAND,
        status: EntityStatusEnum.PENDING_APPROVAL,
        primaryOwnerId: sellerUser._id,
        businessDetails: {
          phone: '+201000000001',
          address: 'Adidas HQ, Cairo',
          taxNumber: 'TAX-ADD-10',
        },
      } as any);
    }

    const entityId = sellingEntity?._id ? sellingEntity._id.toString() : (sellingEntity as any)?.id;

    // 3. Link Brand Admin User to Selling Entity and assign default permissions
    console.log(`🔗 Linking Brand Admin User "${email}" to Selling Entity "${brandName}" & Assigning Permissions...`);
    await userRepo.updateOne(
      { _id: sellerUser._id },
      {
        sellingEntityId: sellingEntity._id,
        role: RolesEnum.COMPANY_ADMIN,
      },
    );

    await permissionRepo.upsertUserPermissions(
      userId,
      DEFAULT_COMPANY_ADMIN_PERMISSIONS,
    );

    console.log('====================================================');
    console.log('✅ Pending Brand Entity & Brand Admin Seeded Successfully!');
    console.log(`   - Connected Database Name : ${dbName}`);
    console.log(`   - Brand Admin User ID    : ${userId}`);
    console.log(`   - Brand Admin Email      : ${email}`);
    console.log(`   - Selling Entity ID      : ${entityId}`);
    console.log(`   - Selling Entity Name    : ${brandName}`);
    console.log(`   - Entity Type            : ${sellingEntity?.type || EntityTypeEnum.BRAND}`);
    console.log(`   - Entity Status          : ${sellingEntity?.status || EntityStatusEnum.PENDING_APPROVAL}`);
    console.log('====================================================');
  } catch (error) {
    console.error('❌ Error during Pending Brand seeding:', error);
  } finally {
    await app.close();
    console.log('🏁 Application context closed cleanly.');
    process.exit(0);
  }
}

bootstrap();
