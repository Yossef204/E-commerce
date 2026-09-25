import { Injectable, Inject } from '@nestjs/common';
import {
  STORAGE_PROVIDER,
  IUploadProvider,
  PresignedUrlOptions,
  PresignedUrlResponse,
} from './providers/upload.providers.interface';

@Injectable()
export class FileUploadsService {
  constructor(
    // eslint-disable-next-line prettier/prettier
    @Inject(STORAGE_PROVIDER)
    private readonly iUploadProvider: IUploadProvider,
  ) {}

  async getPresignedUrl(
    options: PresignedUrlOptions,
  ): Promise<PresignedUrlResponse> {
    return this.iUploadProvider.generatePresignedUploadUrl(options);
  }

  async deleteFile(fileKey: string): Promise<void> {
    return this.iUploadProvider.deleteFile(fileKey);
  }
}
