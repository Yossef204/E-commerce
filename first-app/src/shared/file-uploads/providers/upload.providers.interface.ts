export interface PresignedUrlOptions {
  fileName: string;
  contentType: string;
  folder?: string;
  expiresInSeconds?: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export interface IUploadProvider {
  generatePresignedUploadUrl(
    options: PresignedUrlOptions,
  ): Promise<PresignedUrlResponse>;
  deleteFile(fileKey: string): Promise<void>;
  deleteFiles?(fileKeys: string[]): Promise<void>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
