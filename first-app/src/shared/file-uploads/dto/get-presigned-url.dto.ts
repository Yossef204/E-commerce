import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class GetPresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^image\/(jpeg|png|webp|gif)|application\/pdf$/, {
    message: 'invalid file extention',
  })
  contentType: string;

  @IsString()
  @IsOptional()
  folder?: string;
}
