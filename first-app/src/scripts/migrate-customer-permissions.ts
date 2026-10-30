import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PermissionRepo } from '../models/permission/permission.repository';
import { UserRepo } from '../models/user/user.repository';
import { normalizePermissions } from '../common/utils/permission-normalizer.util';
import { RolesEnum } from '../common/enums/roles';
import { Types } from 'mongoose';

export interface MigrationSummary {
  totalInspected: number;
  totalUpdated: number;
  totalUnchanged: number;
  totalMigratedEntries: number;
  totalDroppedDangerous: number;
  totalDroppedUnknown: number;
}

export async function runPermissionsMigration(): Promise<MigrationSummary> {
  console.log('================================================================');
  console.log('🔄 Starting Customer & Role Permissions Normalization Migration');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const summary: MigrationSummary = {
    totalInspected: 0,
    totalUpdated: 0,
    totalUnchanged: 0,
    totalMigratedEntries: 0,
    totalDroppedDangerous: 0,
    totalDroppedUnknown: 0,
  };

  try {
    const permissionRepo = app.get(PermissionRepo);
    const userRepo = app.get(UserRepo);

    const allPermissionDocs = await permissionRepo.getAll({});
    summary.totalInspected = allPermissionDocs.length;
    console.log(`📋 Found ${allPermissionDocs.length} permission record(s) to inspect.\n`);

    for (const doc of allPermissionDocs) {
      const rawPerms = Array.isArray(doc.permissions) ? doc.permissions : [];
      let userRole: RolesEnum | string = RolesEnum.CUSTOMER;

      if (doc.userId) {
        try {
          const user = await userRepo.getOne({ _id: new Types.ObjectId(doc.userId) });
          if (user?.role) {
            userRole = user.role;
          }
        } catch {
          // fallback to CUSTOMER if user lookup fails
        }
      }

      const normalized = normalizePermissions(rawPerms, userRole);

      summary.totalMigratedEntries += normalized.migratedCount;
      summary.totalDroppedDangerous += normalized.droppedDangerousCount;
      summary.totalDroppedUnknown += normalized.droppedUnknownCount;

      const isChanged =
        normalized.hasChanges ||
        rawPerms.length !== normalized.length ||
        rawPerms.some((p: string) => !normalized.includes(p as any));

      if (isChanged) {
        await permissionRepo.updateOne(
          { _id: doc._id },
          { permissions: [...normalized] },
        );
        summary.totalUpdated++;
        console.log(
          `  ✅ Migrated User #${doc.userId} (${userRole}): ${rawPerms.length} raw -> ${normalized.length} canonical. (Migrated: ${normalized.migratedCount}, Dropped: ${normalized.droppedDangerousCount + normalized.droppedUnknownCount})`,
        );
      } else {
        summary.totalUnchanged++;
      }
    }

    console.log('\n================================================================');
    console.log('🏁 Permissions Normalization Migration Completed');
    console.log(`   - Total Records Inspected:    ${summary.totalInspected}`);
    console.log(`   - Total Documents Updated:    ${summary.totalUpdated}`);
    console.log(`   - Total Already Canonical:    ${summary.totalUnchanged}`);
    console.log(`   - Total Permissions Migrated: ${summary.totalMigratedEntries}`);
    console.log(`   - Total Leaked/Broad Dropped: ${summary.totalDroppedDangerous}`);
    console.log(`   - Total Unknown Strings:      ${summary.totalDroppedUnknown}`);
    console.log('================================================================\n');

    return summary;
  } finally {
    await app.close();
  }
}

// Direct execution guard
if (process.argv[1] && process.argv[1].includes('migrate-customer-permissions')) {
  runPermissionsMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

