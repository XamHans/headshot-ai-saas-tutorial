export interface FileValidationRules {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  maxFiles?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  filename?: string;
  size?: number;
  contentType?: string;
  error?: string;
}

export class FileUploadService {
  private baseUrl: string;
  private defaultRules: FileValidationRules;

  constructor(baseUrl = '/api/upload', defaultRules: FileValidationRules = {}) {
    this.baseUrl = baseUrl;
    this.defaultRules = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/*', 'video/*', 'application/pdf'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.pdf'],
      maxFiles: 5,
      ...defaultRules,
    };
  }

  /**
   * Validate a file against the given rules
   */
  validateFile(file: File, rules: FileValidationRules = {}): { valid: boolean; error?: string } {
    const validationRules = { ...this.defaultRules, ...rules };

    // Check file size
    if (validationRules.maxFileSize && file.size > validationRules.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds ${this.formatFileSize(validationRules.maxFileSize)}`,
      };
    }

    // Check MIME type
    if (validationRules.allowedMimeTypes) {
      const isValidMimeType = validationRules.allowedMimeTypes.some((mimeType) => {
        if (mimeType.endsWith('/*')) {
          return file.type.startsWith(mimeType.slice(0, -1));
        }
        return file.type === mimeType;
      });

      if (!isValidMimeType) {
        return {
          valid: false,
          error: `File type ${file.type} is not allowed`,
        };
      }
    }

    // Check file extension
    if (validationRules.allowedExtensions) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validationRules.allowedExtensions.includes(fileExtension)) {
        return {
          valid: false,
          error: `File extension ${fileExtension} is not allowed`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate multiple files
   */
  validateFiles(
    files: File[],
    rules: FileValidationRules = {},
  ): { valid: boolean; errors: string[] } {
    const validationRules = { ...this.defaultRules, ...rules };
    const errors: string[] = [];

    // Check number of files
    if (validationRules.maxFiles && files.length > validationRules.maxFiles) {
      errors.push(`Maximum ${validationRules.maxFiles} files allowed`);
    }

    // Validate each file
    files.forEach((file, index) => {
      const validation = this.validateFile(file, rules);
      if (!validation.valid) {
        errors.push(`File ${index + 1} (${file.name}): ${validation.error}`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Upload a single file using FormData
   */
  async uploadFile(
    file: File,
    options: {
      onProgress?: (progress: UploadProgress) => void;
      signal?: AbortSignal;
      metadata?: Record<string, string>;
      validationRules?: FileValidationRules;
    } = {},
  ): Promise<UploadResult> {
    const { onProgress, signal, metadata = {}, validationRules = {} } = options;

    // Validate file
    const validation = this.validateFile(file, validationRules);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Add metadata
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        return { success: false, error: errorData.error || 'Upload failed' };
      }

      const result = await response.json();
      return { success: true, ...result };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Upload cancelled' };
      }
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Upload multiple files sequentially
   */
  async uploadFiles(
    files: File[],
    options: {
      onProgress?: (fileIndex: number, progress: UploadProgress) => void;
      onFileComplete?: (fileIndex: number, result: UploadResult) => void;
      signal?: AbortSignal;
      metadata?: Record<string, string>;
      validationRules?: FileValidationRules;
    } = {},
  ): Promise<UploadResult[]> {
    const { onProgress, onFileComplete, signal, metadata = {}, validationRules = {} } = options;

    // Validate all files first
    const validation = this.validateFiles(files, validationRules);
    if (!validation.valid) {
      return files.map(() => ({ success: false, error: validation.errors.join(', ') }));
    }

    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      if (signal?.aborted) {
        results.push({ success: false, error: 'Upload cancelled' });
        continue;
      }

      const file = files[i];
      const result = await this.uploadFile(file, {
        onProgress: (progress) => onProgress?.(i, progress),
        signal,
        metadata,
        validationRules,
      });

      results.push(result);
      onFileComplete?.(i, result);

      if (!result.success) {
        // Continue with other files even if one fails
        console.error(`Failed to upload ${file.name}:`, result.error);
      }
    }

    return results;
  }

  /**
   * Get a presigned URL for direct client upload
   */
  async getPresignedUrl(
    filename: string,
    contentType: string,
  ): Promise<{
    success: boolean;
    presignedUrl?: string;
    key?: string;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        filename,
        contentType,
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to get presigned URL' }));
        return { success: false, error: errorData.error };
      }

      const result = await response.json();
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Delete a file by key
   */
  async deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        return { success: false, error: errorData.error };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Utility: Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Utility: Get file extension
   */
  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Utility: Check if file is image
   */
  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Utility: Check if file is video
   */
  isVideo(file: File): boolean {
    return file.type.startsWith('video/');
  }

  /**
   * Utility: Generate thumbnail for image (client-side)
   */
  async generateImageThumbnail(
    file: File,
    maxWidth = 200,
    maxHeight = 200,
    quality = 0.8,
  ): Promise<Blob | null> {
    if (!this.isImage(file)) return null;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;

        // Draw resized image
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }
}

// Default service instance
export const fileUploadService = new FileUploadService();
