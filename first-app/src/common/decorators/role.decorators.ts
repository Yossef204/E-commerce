import { SetMetadata } from '@nestjs/common';

export const permissions = (permission: string) => {
  return SetMetadata('permissions', permission);
};
