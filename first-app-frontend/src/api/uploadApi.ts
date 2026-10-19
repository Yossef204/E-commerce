import apiClient from './client';

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  fileUrl?: string;
}

export const uploadApi = {
  /**
   * Requests a presigned PUT URL from backend: POST /upload/file
   */
  async getPresignedUrl(
    file: File,
    folder: string = 'products'
  ): Promise<PresignedUrlResponse> {
    const res = await apiClient.post<PresignedUrlResponse>('/upload/file', {
      fileName: file.name,
      contentType: file.type,
      folder,
    });
    return res.data;
  },

  /**
   * Uploads file binary data directly to the S3/storage presigned URL using native fetch.
   * Crucial: Native fetch ensures no Authorization Bearer token is injected, preventing S3 SignatureDoesNotMatch errors.
   */
  async uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(
        `فشل رفع الصورة إلى التخزين السحابي: ${response.status} ${response.statusText}`
      );
    }
  },

  /**
   * Complete lifecycle: get presigned URL -> PUT binary stream to S3 -> return public accessible URL.
   */
  async uploadFile(file: File, folder: string = 'products'): Promise<string> {
    const { uploadUrl, publicUrl, fileUrl } = await this.getPresignedUrl(
      file,
      folder
    );
    await this.uploadToPresignedUrl(uploadUrl, file);
    return fileUrl || publicUrl;
  },
};

export default uploadApi;

