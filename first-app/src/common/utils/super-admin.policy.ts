import { Connection, Types } from 'mongoose';
import { Permission, DEFAULT_SUPER_ADMIN_PERMISSIONS } from '../enums/permissions.enum';
import { RolesEnum } from '../enums/roles';
import { AccountStatusEnum } from '../enums/account-status';

export interface ISuperAdminEvaluationResult {
  isSuperAdmin: boolean;
  userExists: boolean;
  isActive: boolean;
  status: string;
  role: string;
  permissions: string[];
  rejectionReason?: string;
}

/**
 * Centralized, authoritative server-side Super Admin and Account Lifecycle Policy.
 * Verifies identity and active account state strictly from trusted database models.
 * Never trusts raw JWT claims or client-controlled request payloads.
 */
export async function evaluateSuperAdminStatus(
  userId: string | Types.ObjectId,
  connection?: Connection,
  injectedUserDoc?: any,
  injectedPermDoc?: any,
): Promise<ISuperAdminEvaluationResult> {
  const idStr = userId?.toString() || '';
  if (!idStr) {
    return {
      isSuperAdmin: false,
      userExists: false,
      isActive: false,
      status: 'MISSING_ID',
      role: '',
      permissions: [],
      rejectionReason: 'User ID is missing or invalid',
    };
  }

  let dbUser: any = injectedUserDoc || null;
  let permDoc: any = injectedPermDoc || null;

  // 1. Resolve authoritative database documents if not provided
  if (!dbUser && connection && Types.ObjectId.isValid(idStr)) {
    if (connection.readyState !== undefined && connection.readyState !== 1) {
      return {
        isSuperAdmin: false,
        userExists: false,
        isActive: false,
        status: 'DATABASE_ERROR',
        role: '',
        permissions: [],
        rejectionReason: 'Database lookup failed: Database unavailable',
      };
    }

    try {
      const userModel = connection.models['User'];
      if (userModel) {
        dbUser = await userModel.findById(new Types.ObjectId(idStr)).lean();
      }
    } catch {
      return {
        isSuperAdmin: false,
        userExists: false,
        isActive: false,
        status: 'DATABASE_ERROR',
        role: '',
        permissions: [],
        rejectionReason: 'Database lookup failed for user entity',
      };
    }
  }

  if (!permDoc && connection && Types.ObjectId.isValid(idStr)) {
    try {
      const permModel = connection.models['Permission'];
      if (permModel) {
        permDoc = await permModel.findOne({ userId: new Types.ObjectId(idStr) }).lean();
      }
    } catch {
      // Non-fatal: user might not have custom permission document
    }
  }

  // 2. Validate User Existence
  if (!dbUser) {
    return {
      isSuperAdmin: false,
      userExists: false,
      isActive: false,
      status: 'NOT_FOUND',
      role: '',
      permissions: [],
      rejectionReason: `User #${idStr} not found in database`,
    };
  }

  // 3. Validate Account Lifecycle State
  const rawStatus = (dbUser.status || '').toString().toUpperCase().trim();
  const isActive = rawStatus === AccountStatusEnum.ACTIVE || rawStatus === 'ACTIVE';

  const dbRole = (dbUser.role || '').toString().toLowerCase().trim();

  // 4. Resolve Effective Platform Permissions from All Authoritative Sources
  const userDirectPerms: string[] = Array.isArray(dbUser.permissions) ? dbUser.permissions : [];
  const permDocPerms: string[] = Array.isArray(permDoc?.permissions) ? permDoc.permissions : [];
  const effectivePermissions = Array.from(new Set<string>([...userDirectPerms, ...permDocPerms]));

  // 5. Evaluate Super Admin Criteria
  const isSuperAdminRole =
    dbRole === 'super_admin' ||
    dbRole === 'superadmin' ||
    dbRole === RolesEnum.SUPER_ADMIN.toLowerCase();

  const isPlatformAdminRole =
    dbRole === 'admin' || dbRole === RolesEnum.ADMIN.toLowerCase();

  const hasPlatformSuperAdminPerm =
    effectivePermissions.includes(Permission.PLATFORM_SUPER_ADMIN) ||
    effectivePermissions.includes('platform.super_admin');

  // Super Admin requires active account AND either super_admin role OR (admin role + platform.super_admin grant)
  const isSuperAdmin = Boolean(
    isActive && (isSuperAdminRole || (isPlatformAdminRole && hasPlatformSuperAdminPerm)),
  );

  let rejectionReason: string | undefined;
  if (!isActive) {
    rejectionReason = `Account is not active (current status: ${rawStatus || 'UNKNOWN'})`;
  }

  return {
    isSuperAdmin,
    userExists: true,
    isActive,
    status: rawStatus || 'UNKNOWN',
    role: dbRole,
    permissions: effectivePermissions,
    rejectionReason,
  };
}

