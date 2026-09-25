import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import {
  IUploadProvider,
  PresignedUrlOptions,
  PresignedUrlResponse,
} from './upload.providers.interface';

@Injectable()
export class S3StorageProvider implements IUploadProvider {
  private readonly bucketName: string;
  private readonly region: string;
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get('s3').region as string;
    this.bucketName = this.configService.get('s3').bucket;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get('s3').access as string,
        secretAccessKey: this.configService.get('s3').secret as string,
      },
    });
  }

  async generatePresignedUploadUrl(
    options: PresignedUrlOptions,
  ): Promise<PresignedUrlResponse> {
    const extension = options.fileName.split('.').pop();
    const folderPath = options.folder ? `${options.folder}/` : '';
    const fileKey = `${folderPath}${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: options.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: options.expiresInSeconds ?? 900, // 15 دقيقة افتراضياً
    });

    const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileKey}`;

    return { uploadUrl, fileKey, publicUrl };
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully from S3: ${fileKey}`);
    } catch (error) {
      this.logger.error(`Error deleting file from S3: ${fileKey}`, error);
      throw error;
    }
  }
}
