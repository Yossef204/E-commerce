import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'IS_PUBLIC';
export const isPublic = () => {
  return SetMetadata(IS_PUBLIC, true);
};
