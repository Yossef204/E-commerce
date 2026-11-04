import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export function isName() {
  return applyDecorators(
    IsString(),
    IsNotEmpty(),
    MinLength(2),
    MaxLength(100),
  );
}
