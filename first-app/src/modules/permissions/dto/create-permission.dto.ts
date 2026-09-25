export class CreatePermissionDto {
  // @IsNotEmpty({ message: 'User ID is required' })
  // @IsMongoId({ message: 'Invalid User ID format' })
  userId: string;

  // @IsArray({ message: 'Permissions must be an array' })
  // @ArrayNotEmpty({ message: 'Permissions array cannot be empty' })
  // @IsString({ each: true, message: 'Each permission must be a string' })
  permissions: string[];
}
