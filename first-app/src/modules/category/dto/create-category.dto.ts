import { isName } from '../../../common/dto/validation.dto';
import { IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @isName()
  name: string;

  @IsString()
  @IsOptional()
  image: string;

  @IsString()
  @IsOptional()
  folderId: string;
}
