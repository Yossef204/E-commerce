import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import {
  IUploadProvider,
  PresignedUrlOptions,
  PresignedUrlResponse,
} from './upload.providers.interface';

@Injectable()
export class CloudinaryStorageProvider implements IUploadProvider {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    this.cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME') as string;
    this.apiKey = this.configService.get('CLOUDINARY_API_KEY') as string;
    this.apiSecret = this.configService.get('CLOUDINARY_API_SECRET') as string;

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
    });
  }

  async generatePresignedUploadUrl(
    options: PresignedUrlOptions,
  ): Promise<PresignedUrlResponse> {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = options.folder || 'uploads';
    const publicId = `${folder}/${randomUUID()}`;

    // توليد توقيع مصادق عليه للرفع المباشر من الفرونت إند
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, public_id: publicId },
      this.apiSecret,
    );

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload?api_key=${this.apiKey}&timestamp=${timestamp}&signature=${signature}&public_id=${publicId}`;
    const publicUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload/${publicId}`;

    return { uploadUrl, fileKey: publicId, publicUrl };
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      // إزالة الامتداد إن وُجد لأن Cloudinary يتعامل مع public_id بدون extension
      const cleanPublicId = fileKey.replace(/\.[^/.]+$/, '');
      const result = await cloudinary.uploader.destroy(cleanPublicId);

      if (result.result !== 'ok' && result.result !== 'not found') {
        this.logger.warn(
          `Cloudinary delete warning for ${cleanPublicId}: ${result.result}`,
        );
      } else {
        this.logger.log(
          `File deleted successfully from Cloudinary: ${cleanPublicId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete file from Cloudinary: ${fileKey}`,
        error,
      );
      throw error;
    }
  }

  async deleteFiles(fileKeys: string[]): Promise<void> {
    if (!fileKeys || fileKeys.length === 0) return;

    try {
      const cleanPublicIds = fileKeys.map((key) =>
        key.replace(/\.[^/.]+$/, ''),
      );
      await cloudinary.api.delete_resources(cleanPublicIds);
      this.logger.log(
        `Bulk files deleted from Cloudinary: ${cleanPublicIds.length} files`,
      );
    } catch (error) {
      this.logger.error(`Failed to delete bulk files from Cloudinary`, error);
      throw error;
    }
  }
}
