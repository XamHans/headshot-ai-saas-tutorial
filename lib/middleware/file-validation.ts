import type { NextRequest } from 'next/server';

export interface FileValidationConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFiles: number;
  scanForMalware?: boolean;
  restrictUploadsToAuth?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const DEFAULT_FILE_VALIDATION: FileValidationConfig = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain',
    'application/json',
  ],
  allowedExtensions: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.mp4',
    '.webm',
    '.pdf',
    '.txt',
    '.json',
  ],
  maxFiles: 10,
  scanForMalware: false,
  restrictUploadsToAuth: false,
};

export class FileValidator {
  private config: FileValidationConfig;

  constructor(config: Partial<FileValidationConfig> = {}) {
    this.config = { ...DEFAULT_FILE_VALIDATION, ...config };
  }

  /**
   * Validate a single file
   */
  validateFile(file: File): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > this.config.maxFileSize) {
      errors.push(
        `File size ${this.formatBytes(file.size)} exceeds maximum allowed size ${this.formatBytes(this.config.maxFileSize)}`,
      );
    }

    // Check MIME type
    if (!this.isAllowedMimeType(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`);
    }

    // Check file extension
    const extension = this.getFileExtension(file.name);
    if (!this.isAllowedExtension(extension)) {
      errors.push(`File extension '${extension}' is not allowed`);
    }

    // Check for potentially dangerous files
    if (this.isPotentiallyDangerous(file)) {
      errors.push('File appears to be potentially dangerous and cannot be uploaded');
    }

    // Check for empty files
    if (file.size === 0) {
      errors.push('Empty files are not allowed');
    }

    // Check filename for suspicious patterns
    if (this.hasSuspiciousFilename(file.name)) {
      warnings.push('Filename contains potentially suspicious characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate multiple files
   */
  validateFiles(files: File[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check number of files
    if (files.length > this.config.maxFiles) {
      errors.push(
        `Number of files (${files.length}) exceeds maximum allowed (${this.config.maxFiles})`,
      );
    }

    // Check total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = this.config.maxFileSize * this.config.maxFiles;
    if (totalSize > maxTotalSize) {
      errors.push(
        `Total files size ${this.formatBytes(totalSize)} exceeds maximum allowed ${this.formatBytes(maxTotalSize)}`,
      );
    }

    // Validate each file
    files.forEach((file, index) => {
      const result = this.validateFile(file);
      if (!result.isValid) {
        errors.push(`File ${index + 1} (${file.name}): ${result.errors.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        warnings.push(`File ${index + 1} (${file.name}): ${result.warnings.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate request headers for security
   */
  validateRequest(request: NextRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      errors.push('Invalid content type for file upload');
    }

    // Check origin if in production
    if (process.env.NODE_ENV === 'production') {
      const origin = request.headers.get('origin');
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
        errors.push('Upload from this origin is not allowed');
      }
    }

    // Check for rate limiting headers (if implemented)
    const userAgent = request.headers.get('user-agent');
    if (!userAgent || this.isSuspiciousUserAgent(userAgent)) {
      warnings.push('Suspicious user agent detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize filename for storage
   */
  sanitizeFilename(filename: string): string {
    // Remove path traversal attempts
    let sanitized = filename.replace(/\.\./g, '');

    // Remove or replace dangerous characters
    sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

    // Limit length
    if (sanitized.length > 255) {
      const extension = this.getFileExtension(sanitized);
      const nameWithoutExt = sanitized.slice(0, -extension.length);
      sanitized = nameWithoutExt.slice(0, 255 - extension.length) + extension;
    }

    // Ensure it doesn't start with a dot or dash
    sanitized = sanitized.replace(/^[.-]/, '_');

    return sanitized;
  }

  /**
   * Generate secure filename with timestamp
   */
  generateSecureFilename(originalFilename: string): string {
    const extension = this.getFileExtension(originalFilename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedBasename = this.sanitizeFilename(
      originalFilename.slice(0, -extension.length),
    ).slice(0, 50);

    return `${timestamp}_${random}_${sanitizedBasename}${extension}`;
  }

  // Private helper methods
  private isAllowedMimeType(mimeType: string): boolean {
    return this.config.allowedMimeTypes.some((allowed) => {
      if (allowed.endsWith('/*')) {
        return mimeType.startsWith(allowed.slice(0, -1));
      }
      return mimeType === allowed;
    });
  }

  private isAllowedExtension(extension: string): boolean {
    return this.config.allowedExtensions.includes(extension.toLowerCase());
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot) : '';
  }

  private isPotentiallyDangerous(file: File): boolean {
    const dangerousExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.scr',
      '.pif',
      '.com',
      '.js',
      '.vbs',
      '.vbe',
      '.jse',
      '.ws',
      '.wsf',
      '.sh',
      '.bash',
      '.ps1',
      '.app',
      '.dmg',
      '.pkg',
    ];

    const extension = this.getFileExtension(file.name).toLowerCase();
    if (dangerousExtensions.includes(extension)) {
      return true;
    }

    // Check for double extensions (like file.pdf.exe)
    const parts = file.name.split('.');
    if (parts.length > 2) {
      const secondLastExtension = '.' + parts[parts.length - 2].toLowerCase();
      if (dangerousExtensions.includes(secondLastExtension)) {
        return true;
      }
    }

    // Check for null bytes in filename
    if (file.name.includes('\0')) {
      return true;
    }

    return false;
  }

  private hasSuspiciousFilename(filename: string): boolean {
    // Check for path traversal
    if (filename.includes('../') || filename.includes('..\\')) {
      return true;
    }

    // Check for control characters
    if (/[\x00-\x1f\x7f-\x9f]/.test(filename)) {
      return true;
    }

    // Check for very long filenames
    if (filename.length > 255) {
      return true;
    }

    return false;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export default validator instance
export const fileValidator = new FileValidator();

// Security middleware for file uploads
export function createFileUploadSecurityMiddleware(config?: Partial<FileValidationConfig>) {
  const validator = new FileValidator(config);

  return {
    validateRequest: (request: NextRequest) => validator.validateRequest(request),
    validateFiles: (files: File[]) => validator.validateFiles(files),
    sanitizeFilename: (filename: string) => validator.sanitizeFilename(filename),
    generateSecureFilename: (filename: string) => validator.generateSecureFilename(filename),
  };
}
