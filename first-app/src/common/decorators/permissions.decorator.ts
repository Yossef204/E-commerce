import { SetMetadata } from '@nestjs/common';
import { PermissionEnum, Permission } from '../enums/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

export const permissions = (...perms: (PermissionEnum | Permission | string)[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

export const Permissions = permissions;
