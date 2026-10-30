import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileUploadsService } from './file-uploads.service';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('File Uploads')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@Controller('upload')
export class FileUploadsController {
  constructor(private readonly fileUploadsService: FileUploadsService) {}

  @permissions(Permission.FILE_UPLOAD)
  @Post('file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate presigned S3/Cloudinary upload URL' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Presigned URL generated successfully' })
  async getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
    return this.fileUploadsService.getPresignedUrl({
      fileName: dto.fileName,
      contentType: dto.contentType,
      folder: dto.folder,
    });
  }
}
