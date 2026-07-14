'use client';

import type { HeadshotPreviewDTO } from '@/modules/headshot/types';

interface HeadshotResultsProps {
  previews: HeadshotPreviewDTO[];
}

/**
 * Grid of watermarked preview images. Only the (signed) preview URL is ever
 * rendered — the clean full-res image is not reachable from here (unlocked in
 * a later, post-payment slice).
 */
export function HeadshotResults({ previews }: HeadshotResultsProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Here are your headshot previews. Unlock to download the clean, full-resolution versions.
      </p>
      <ul
        className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-3"
        data-testid="headshot-previews"
        aria-label="Headshot previews"
      >
        {previews.map((preview, i) => (
          <li key={preview.id} className="overflow-hidden rounded-lg border">
            {/* biome-ignore lint/performance/noImgElement: signed R2 preview URLs are dynamic and short-lived; next/image adds no value and complicates the strict setup. */}
            <img
              src={preview.previewUrl}
              alt={`Watermarked headshot preview ${i + 1}`}
              className="aspect-square w-full object-cover"
              data-testid="headshot-preview-image"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
