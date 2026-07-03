'use client';

import { AlertCircle, CheckCircle, File, Image, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadedFile {
  url: string;
  key: string;
  filename: string;
  secureFilename: string;
  size: number;
  contentType?: string;
  warnings?: string[];
}

interface DropzoneProps {
  onFilesChange?: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  accept?: Record<string, string[]>;
  className?: string;
  disabled?: boolean;
}

export function Dropzone({
  onFilesChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
  },
  className,
  disabled = false,
}: DropzoneProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>(
    'idle',
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    disabled: disabled || uploadStatus === 'uploading',
    onDrop: (acceptedFiles) => {
      const filesWithPreview = acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        }),
      );

      setFiles((prev) => [...prev, ...filesWithPreview]);
      onFilesChange?.(acceptedFiles);
    },
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError(null);

    try {
      const uploadPromises = files.map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to upload ${file.name}`);
        }

        const result = await response.json();
        setUploadProgress((prev) => prev + 100 / files.length);
        return result;
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Store uploaded files
      const newUploadedFiles = uploadResults.map((result) => ({
        url: result.url,
        key: result.key,
        filename: result.filename,
        secureFilename: result.secureFilename,
        size: result.size,
        contentType: result.contentType,
        warnings: result.warnings || [],
      }));

      setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);
      setUploadStatus('success');

      // Clear selected files after successful upload
      setTimeout(() => {
        setFiles([]);
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 1000);
    } catch (error) {
      setUploadStatus('error');
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const clearAll = () => {
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setUploadedFiles([]);
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400',
          disabled || uploadStatus === 'uploading' ? 'opacity-50 cursor-not-allowed' : '',
          uploadStatus === 'success' ? 'border-green-500 bg-green-50' : '',
          uploadStatus === 'error' ? 'border-red-500 bg-red-50' : '',
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-4">
          {uploadStatus === 'uploading' ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">Uploading... {Math.round(uploadProgress)}%</p>
            </>
          ) : uploadStatus === 'success' ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium text-green-700">Upload successful!</p>
            </>
          ) : uploadStatus === 'error' ? (
            <>
              <AlertCircle className="h-12 w-12 text-red-500" />
              <p className="text-lg font-medium text-red-700">Upload failed</p>
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-sm text-gray-500">
                  or click to select files (max {maxFiles} files, {formatFileSize(maxSize)} each)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 space-y-2">
          {fileRejections.map(({ file, errors }, index) => (
            <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
              <span className="font-medium">{file.name}</span>:{' '}
              {errors.map((e) => e.message).join(', ')}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Selected Files ({files.length})</h3>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={uploadStatus === 'uploading'}
              >
                Clear All
              </Button>
              <Button
                onClick={uploadFiles}
                disabled={uploadStatus === 'uploading' || files.length === 0}
                size="sm"
              >
                {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {files.map((file, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-10 w-10 object-cover rounded"
                    />
                  ) : file.type.startsWith('image/') ? (
                    <Image className="h-10 w-10 text-gray-400" />
                  ) : (
                    <File className="h-10 w-10 text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={uploadStatus === 'uploading'}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Uploaded Files ({uploadedFiles.length})</h3>
            <Button variant="outline" size="sm" onClick={() => setUploadedFiles([])}>
              Clear Uploaded
            </Button>
          </div>

          <div className="grid gap-3">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex-shrink-0">
                  {file.contentType?.startsWith('image/') ? (
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="h-16 w-16 object-cover rounded border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDlWN0MgMjEgNS45IDIwLjEgNSAxOSA1SDVDMy45IDUgMyA1LjkgMyA3VjlNMjEgOVYxN0MgMjEgMTguMSAyMC4xIDE5IDE5IDE5SDVDIDMuOSAxOSAzIDE4LjEgMyAxN1Y5TTIxIDlMMTMuNSAxNC41QyAxMy4xIDE0LjggMTIuOSAxNC44IDEyLjUgMTQuNUwzIDkiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K';
                      }}
                    />
                  ) : (
                    <File className="h-16 w-16 text-gray-400 p-3 bg-gray-100 rounded" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-green-800">{file.filename}</p>
                  <p className="text-xs text-gray-600 truncate">
                    {formatFileSize(file.size)} • {file.contentType}
                  </p>
                  <p className="text-xs text-blue-600 truncate">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      View uploaded file ↗
                    </a>
                  </p>
                  {file.warnings && file.warnings.length > 0 && (
                    <p className="text-xs text-orange-600">Warnings: {file.warnings.join(', ')}</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeUploadedFile(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
