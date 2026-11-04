import {
  IsArray,
  ArrayNotEmpty,
  IsMongoId,
  IsNotEmpty,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../common/enums/permission.enum';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Target user MongoDB ObjectId',
    example: '6abaa7508528c65b5d341a95',
  })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsMongoId({ message: 'Invalid User ID format' })
  userId: string;

  @ApiProperty({
    description: 'Array of canonical permission strings',
    example: ['product.read', 'order.read_own'],
    type: [String],
  })
  @IsArray({ message: 'Permissions must be an array' })
  @ArrayNotEmpty({ message: 'Permissions array cannot be empty' })
  @IsString({ each: true, message: 'Each permission must be a string' })
  @IsIn(Object.values(Permission), {
    each: true,
    message: 'Each permission must be a valid canonical permission',
  })
  permissions: string[];
}
