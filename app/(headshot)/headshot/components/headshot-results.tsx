'use client';

import type { HeadshotPreviewDTO } from '@/modules/headshot/types';

interface HeadshotResultsProps {
  previews: HeadshotPreviewDTO[];
}

/**
 * Grid of watermarked preview images, shown large so the result is easy to
 * judge. Only the (signed) preview URL is ever rendered — the clean full-res
 * image is not reachable from here (unlocked in a later, post-payment slice).
 */
export function HeadshotResults({ previews }: HeadshotResultsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Here are your headshot previews. Unlock to download the clean, full-resolution versions.
      </p>
      <ul
        className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 xl:grid-cols-3"
        data-testid="headshot-previews"
        aria-label="Headshot previews"
      >
        {previews.map((preview, i) => (
          <li
            key={preview.id}
            className="group overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md"
          >
            {/* biome-ignore lint/performance/noImgElement: signed R2 preview URLs are dynamic and short-lived; next/image adds no value and complicates the strict setup. */}
            <img
              src={preview.previewUrl}
              alt={`Watermarked headshot preview ${i + 1}`}
              className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              data-testid="headshot-preview-image"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
