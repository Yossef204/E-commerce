import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'IS_PUBLIC';

// 👈 تصدير الدالة كـ Decorator يُستدعى بالأقواس
export const isPublic = () => SetMetadata(IS_PUBLIC, true);
export const Public = () => SetMetadata(IS_PUBLIC, true);