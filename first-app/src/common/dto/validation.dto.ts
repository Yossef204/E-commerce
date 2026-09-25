import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, Max, Min } from 'class-validator';

export function isName() {
  return applyDecorators(IsString(), IsNotEmpty(), Min(2), Max(20));
}
