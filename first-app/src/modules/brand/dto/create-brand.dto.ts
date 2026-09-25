import { isName } from '../../../common/dto/validation.dto';
import { IsArray, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @isName()
  name: string;

  @IsArray()
  @IsMongoId()
  categoryId: string[];

  @IsString()
  @IsOptional()
  image: string;

  @IsString()
  @IsOptional()
  folderId: string;
}
