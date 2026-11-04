import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { RolesEnum } from '../common/enums/roles';

dotenv.config();

export interface RoleMigrationSummary {
  inspected: number;
  sellerUpdated: number;
  adminUpdated: number;
  customerUpdated: number;
  companyAdminUpdated: number;
  superAdminUpdated: number;
  distinctRolesBefore: string[];
  distinctRolesAfter: string[];
}

export async function runRoleNormalizationMigration(dbUrl?: string): Promise<RoleMigrationSummary> {
  const connectionUrl = dbUrl || process.env.DB_URL;
  if (!connectionUrl) {
    throw new Error('Database connection string DB_URL is required');
  }

  console.log('================================================================');
  console.log('🔄 Starting Database Role Case Normalization Migration');
  console.log('================================================================\n');

  const connection = await mongoose.createConnection(connectionUrl).asPromise();

  try {
    const usersCollection = connection.collection('users');

    const distinctBefore = await usersCollection.distinct('role');
    console.log('📋 Distinct Roles BEFORE Migration:', distinctBefore);

    const totalUsers = await usersCollection.countDocuments();
    console.log(`👤 Total User Records in Database: ${totalUsers}`);

    // 1. Update Seller variations ('Seller', 'SELLER') -> 'seller'
    const sellerRes = await usersCollection.updateMany(
      { role: { $regex: /^seller$/i, $ne: RolesEnum.SELLER } },
      { $set: { role: RolesEnum.SELLER } },
    );
    console.log(`  ✅ Normalized SELLER roles: ${sellerRes.modifiedCount} document(s) updated to '${RolesEnum.SELLER}'`);

    // 2. Update Admin variations ('Admin', 'ADMIN') -> 'admin'
    const adminRes = await usersCollection.updateMany(
      { role: { $regex: /^admin$/i, $ne: RolesEnum.ADMIN } },
      { $set: { role: RolesEnum.ADMIN } },
    );
    console.log(`  ✅ Normalized ADMIN roles: ${adminRes.modifiedCount} document(s) updated to '${RolesEnum.ADMIN}'`);

    // 3. Update Customer variations ('Customer', 'CUSTOMER') -> 'customer'
    const customerRes = await usersCollection.updateMany(
      { role: { $regex: /^customer$/i, $ne: RolesEnum.CUSTOMER } },
      { $set: { role: RolesEnum.CUSTOMER } },
    );
    console.log(`  ✅ Normalized CUSTOMER roles: ${customerRes.modifiedCount} document(s) updated to '${RolesEnum.CUSTOMER}'`);

    // 4. Update Company Admin variations ('Company_Admin', 'COMPANY_ADMIN') -> 'company_admin'
    const companyAdminRes = await usersCollection.updateMany(
      { role: { $regex: /^company_admin$/i, $ne: RolesEnum.COMPANY_ADMIN } },
      { $set: { role: RolesEnum.COMPANY_ADMIN } },
    );
    console.log(`  ✅ Normalized COMPANY_ADMIN roles: ${companyAdminRes.modifiedCount} document(s) updated to '${RolesEnum.COMPANY_ADMIN}'`);

    // 5. Update Super Admin variations ('Super_Admin', 'SUPER_ADMIN') -> 'super_admin'
    const superAdminRes = await usersCollection.updateMany(
      { role: { $regex: /^super_admin$/i, $ne: RolesEnum.SUPER_ADMIN } },
      { $set: { role: RolesEnum.SUPER_ADMIN } },
    );
    console.log(`  ✅ Normalized SUPER_ADMIN roles: ${superAdminRes.modifiedCount} document(s) updated to '${RolesEnum.SUPER_ADMIN}'`);

    const distinctAfter = await usersCollection.distinct('role');
    console.log('\n📋 Distinct Roles AFTER Migration:', distinctAfter);
    console.log('================================================================');
    console.log('🏁 Role Normalization Migration Completed Successfully');
    console.log('================================================================\n');

    return {
      inspected: totalUsers,
      sellerUpdated: sellerRes.modifiedCount,
      adminUpdated: adminRes.modifiedCount,
      customerUpdated: customerRes.modifiedCount,
      companyAdminUpdated: companyAdminRes.modifiedCount,
      superAdminUpdated: superAdminRes.modifiedCount,
      distinctRolesBefore: distinctBefore,
      distinctRolesAfter: distinctAfter,
    };
  } finally {
    await connection.close();
  }
}

// Direct execution
if (require.main === module) {
  runRoleNormalizationMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Role migration failed:', err);
      process.exit(1);
    });
}

