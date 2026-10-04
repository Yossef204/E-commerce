import { SetMetadata } from '@nestjs/common';
import { PermissionEnum } from '../enums/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

export const permissions = (...perms: PermissionEnum[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

export const Permissions = permissions;
