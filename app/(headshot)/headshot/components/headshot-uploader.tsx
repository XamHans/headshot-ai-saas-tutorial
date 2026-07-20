'use client';

import { CheckCircle2, ImageUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fileUploadService } from '@/lib/services/file-upload';
import {
  HEADSHOT_ALLOWED_EXTENSIONS,
  HEADSHOT_ALLOWED_MIME_TYPES,
  HEADSHOT_MAX_FILE_SIZE,
} from '@/modules/headshot/schemas';
import type { HeadshotJob } from '@/modules/headshot/types';
import { useHeadshotUpload } from '../hooks/use-headshot-upload';

const CLIENT_VALIDATION_RULES = {
  maxFileSize: HEADSHOT_MAX_FILE_SIZE,
  allowedMimeTypes: [...HEADSHOT_ALLOWED_MIME_TYPES],
  allowedExtensions: [...HEADSHOT_ALLOWED_EXTENSIONS],
  maxFiles: 1,
};

/**
 * Single-photo uploader for the headshot flow. Client-side validation gives
 * instant feedback; the server independently re-validates and runs the
 * pre-flight face gate before any job is created. All async state comes from
 * the mutation (`isPending` / `isError` / `error`), never local flags.
 */
interface HeadshotUploaderProps {
  /** Called once a source photo passes the gate and a pending job is created. */
  onJobCreated?: (job: HeadshotJob) => void;
}

export function HeadshotUploader({ onJobCreated }: HeadshotUploaderProps = {}) {
  const upload = useHeadshotUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = (file: File) => {
    const validation = fileUploadService.validateFile(file, CLIENT_VALIDATION_RULES);
    if (!validation.valid) {
      toast.error(validation.error ?? 'That file is not allowed.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedName(file.name);

    upload.mutate(file, {
      onSuccess: (job) => {
        toast.success('Photo accepted! You can now pick a style.');
        onJobCreated?.(job);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const succeeded = upload.isSuccess;

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Upload your photo</CardTitle>
        <CardDescription>
          One clear, well-lit photo facing the camera — just you, no sunglasses. JPEG or PNG, up to
          10MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          disabled={upload.isPending}
          className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-muted-foreground/50 disabled:opacity-60"
        >
          {previewUrl ? (
            // biome-ignore lint/performance/noImgElement: local object-URL preview of the just-selected file; next/image cannot handle blob: URLs.
            <img
              src={previewUrl}
              alt="Selected preview"
              className="max-h-40 rounded-md object-contain"
            />
          ) : (
            <ImageUp className="h-10 w-10 text-muted-foreground" aria-hidden />
          )}
          <span className="text-sm text-muted-foreground">
            {selectedName ?? 'Click to choose a photo or drag it here'}
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={HEADSHOT_ALLOWED_MIME_TYPES.join(',')}
          className="sr-only"
          aria-label="Upload photo"
          onChange={onInputChange}
        />

        {upload.isPending && (
          // biome-ignore lint/a11y/useSemanticElements: a polite live status region, not an <output> for a form result.
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Checking your photo…
          </div>
        )}

        {upload.isError && (
          <p className="text-sm text-destructive" role="alert">
            {upload.error.message}
          </p>
        )}

        {succeeded ? (
          // biome-ignore lint/a11y/useSemanticElements: a polite live status region, not an <output> for a form result.
          <div
            className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
            <span>Photo accepted — now choose a style below.</span>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? 'Uploading…' : 'Choose photo'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
