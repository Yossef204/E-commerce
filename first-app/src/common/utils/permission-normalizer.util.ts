import {
  Permission,
  VALID_PERMISSIONS_SET,
  LEGACY_PERMISSION_MAP,
} from '../enums/permissions.enum';
import { RolesEnum } from '../enums/roles';

export interface PermissionNormalizationMetrics {
  permissions: Permission[];
  migratedCount: number;
  droppedUnknownCount: number;
  droppedDangerousCount: number;
  hasChanges: boolean;
}

export type NormalizedPermissions = Permission[] & PermissionNormalizationMetrics;

/**
 * Normalizes, canonicalizes, and deduplicates an array of permission strings:
 * - Checks legacy translations in LEGACY_PERMISSION_MAP
 * - Validates against VALID_PERMISSIONS_SET
 * - Drops dangerous or broad permissions explicitly mapped to null (e.g. orders.read, order.read)
 * - Drops unknown / malicious strings
 * - Eliminates duplicates and returns a clean, unique Permission[] array with attached metrics
 */
export function normalizePermissions(
  rawPermissions: (string | Permission)[] | undefined | null,
  role?: RolesEnum | string,
): NormalizedPermissions {
  const input = Array.isArray(rawPermissions) ? rawPermissions : [];
  const normalizedSet = new Set<Permission>();
  let migratedCount = 0;
  let droppedUnknownCount = 0;
  let droppedDangerousCount = 0;

  const isCustomer =
    role &&
    (role === RolesEnum.CUSTOMER ||
      role === RolesEnum.user ||
      (typeof role === 'string' &&
        (role.toLowerCase() === 'customer' || role.toLowerCase() === 'user')));

  for (const item of input) {
    if (!item || typeof item !== 'string') {
      droppedUnknownCount++;
      continue;
    }

    const trimmed = item.trim();

    // 1. Check legacy dictionary first (for plurals & explicit drops)
    if (Object.prototype.hasOwnProperty.call(LEGACY_PERMISSION_MAP, trimmed)) {
      const mapped = LEGACY_PERMISSION_MAP[trimmed];
      if (mapped === null) {
        // Broad/dangerous key explicitly discarded (e.g. orders.read, order.read)
        droppedDangerousCount++;
        continue;
      }
      normalizedSet.add(mapped);
      migratedCount++;
      continue;
    }

    // 2. Check if it's already a valid canonical permission
    if (VALID_PERMISSIONS_SET.has(trimmed)) {
      // If customer role, discard broad admin permissions if they were inappropriately injected
      if (
        isCustomer &&
        (trimmed === 'orders.read' ||
          trimmed === 'order.read' ||
          trimmed === 'order.read_all' ||
          trimmed === 'payout.process' ||
          trimmed === 'refund.execute' ||
          trimmed === 'product.approve' ||
          trimmed === 'profile.manage')
      ) {
        droppedDangerousCount++;
        continue;
      }
      normalizedSet.add(trimmed as Permission);
      continue;
    }

    // 3. Unknown or unregistered permission string
    droppedUnknownCount++;
  }

  const resultArr = Array.from(normalizedSet) as NormalizedPermissions;
  resultArr.permissions = Array.from(normalizedSet);
  resultArr.migratedCount = migratedCount;
  resultArr.droppedUnknownCount = droppedUnknownCount;
  resultArr.droppedDangerousCount = droppedDangerousCount;
  resultArr.hasChanges =
    migratedCount > 0 ||
    droppedUnknownCount > 0 ||
    droppedDangerousCount > 0 ||
    resultArr.length !== input.length;

  return resultArr;
}

