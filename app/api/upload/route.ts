import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/api/base';
import { fileValidator } from '@/lib/middleware/file-validation';
import { r2Storage } from '@/lib/storage/r2-client';

const uploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().positive(),
});

// Handle direct file uploads
export const POST = withErrorHandling(async (req: NextRequest) => {
  try {
    // Validate request headers
    const requestValidation = fileValidator.validateRequest(req);
    if (!requestValidation.isValid) {
      return {
        body: { error: 'Invalid request', details: requestValidation.errors },
        status: 400,
      };
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return { error: 'No file provided', status: 400 };
    }

    // Validate file with security checks
    const fileValidation = fileValidator.validateFile(file);
    if (!fileValidation.isValid) {
      return {
        body: {
          error: 'File validation failed',
          details: fileValidation.errors,
          warnings: fileValidation.warnings,
        },
        status: 400,
      };
    }

    // Basic schema validation
    const validation = uploadSchema.safeParse({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });

    if (!validation.success) {
      return {
        body: { error: 'Invalid file data', details: validation.error.issues },
        status: 400,
      };
    }

    // Generate secure filename and key
    const secureFilename = fileValidator.generateSecureFilename(file.name);
    const fileKey = `uploads/${secureFilename}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const uploadUrl = await r2Storage.uploadFile(fileKey, buffer, file.type);

    return {
      success: true,
      url: uploadUrl,
      key: fileKey,
      filename: file.name,
      secureFilename,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      warnings: fileValidation.warnings,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return { error: 'Upload failed' }, { status: 500 };
  }
});

// Generate presigned URLs for direct client uploads
export const GET = withErrorHandling(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get('filename');
  const contentType = searchParams.get('contentType');

  if (!filename || !contentType) {
    return { error: 'Missing filename or contentType' }, { status: 400 };
  }

  try {
    const fileExtension = filename.split('.').pop();
    const fileKey = `uploads/${nanoid()}.${fileExtension}`;

    const presignedUrl = await r2Storage.getPresignedUploadUrl(fileKey, contentType);

    return {
      presignedUrl,
      key: fileKey,
      filename,
      contentType,
    };
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    return { error: 'Failed to generate upload URL' }, { status: 500 };
  }
});

// Handle file deletion
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const fileKey = searchParams.get('key');

  if (!fileKey) {
    return { body: { error: 'Missing file key' }, status: 400 };
  }

  try {
    await r2Storage.deleteFile(fileKey);
    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error('Delete error:', error);
    return { error: 'Failed to delete file' }, { status: 500 };
  }
});

// Tus protocol handlers for resumable uploads
export const PATCH = withErrorHandling(async (req: NextRequest) => {
  // This will be implemented with tus server integration
  console.log('Tus PATCH request received');
  return new NextResponse(null, { status: 204 });
});

export const HEAD = withErrorHandling(async (req: NextRequest) => {
  // This will be implemented with tus server integration
  console.log('Tus HEAD request received');
  return new NextResponse(null, { status: 204 });
});

export const OPTIONS = withErrorHandling(async (req: NextRequest) => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, HEAD, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, tus-resumable, upload-metadata, upload-length, upload-offset',
      'Access-Control-Expose-Headers': 'tus-resumable, upload-offset, location',
    },
  });
});
