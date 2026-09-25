import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FileUploadsService } from './file-uploads.service';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
@UseGuards(AuthenticationGuard)
@Controller('upload')
export class FileUploadsController {
  constructor(private readonly fileUploadsService: FileUploadsService) {}

  @Post('file')
  @HttpCode(HttpStatus.OK)
  async getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
    return this.fileUploadsService.getPresignedUrl({
      fileName: dto.fileName,
      contentType: dto.contentType,
      folder: dto.folder,
    });
  }
}
