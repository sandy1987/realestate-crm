import { apiClient } from './client';

export interface UploadedMediaItem {
  url: string;
  secure_url: string;
  publicId: string;
  resourceType: 'image' | 'video';
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  duration?: number | null;
  originalFilename?: string;
}

export const mediaApi = {
  /**
   * Upload single file (image or video) to Cloudinary through authenticated backend.
   */
  async uploadFile(file: File): Promise<UploadedMediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<UploadedMediaItem>('/media/upload', formData, {
      timeoutMs: 120000, // 2 minutes for video uploads
    });
    return res.data;
  },

  /**
   * Upload multiple files to Cloudinary through authenticated backend.
   */
  async uploadFiles(files: File[]): Promise<UploadedMediaItem[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const res = await apiClient.post<UploadedMediaItem[] | UploadedMediaItem>('/media/upload', formData, {
      timeoutMs: 180000,
    });
    return Array.isArray(res.data) ? res.data : [res.data];
  },

  /**
   * Delete uploaded asset from Cloudinary.
   */
  async deleteMedia(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    await apiClient.delete<unknown>(`/media/${encodeURIComponent(publicId)}`, {
      params: { resourceType },
    });
  },
};
