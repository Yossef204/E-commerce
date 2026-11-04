import { SetMetadata } from '@nestjs/common';
import { RolesEnum } from '../enums/roles';
export * from './permissions.decorator';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (RolesEnum | string)[]) =>
  SetMetadata(ROLES_KEY, roles);
