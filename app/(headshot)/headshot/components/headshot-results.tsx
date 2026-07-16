'use client';

import { Download, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { HeadshotJob, HeadshotPreviewDTO } from '@/modules/headshot/types';
import { useFullResImages, useUnlockHeadshot } from '../hooks/use-headshot-unlock';

interface HeadshotResultsProps {
  job: HeadshotJob;
  previews: HeadshotPreviewDTO[];
}

/**
 * Grid of watermarked preview images. Before unlock, only the (signed) preview
 * URL is rendered and an "Unlock ($5)" button starts a one-time Stripe Checkout.
 * Once the job is unlocked, short-lived signed full-res download links are
 * shown — the clean full-res image is never reachable from here before payment.
 */
export function HeadshotResults({ job, previews }: HeadshotResultsProps) {
  const unlock = useUnlockHeadshot(job.id);
  const fullRes = useFullResImages(job.id, job.unlocked === true);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {job.unlocked
          ? 'Your clean, full-resolution headshots are ready to download.'
          : 'Here are your headshot previews. Unlock to download the clean, full-resolution versions.'}
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

      {job.unlocked ? (
        <div className="flex flex-col gap-2" data-testid="headshot-downloads">
          {fullRes.isPending && (
            // biome-ignore lint/a11y/useSemanticElements: a polite live status region, not an <output> for a form result.
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Preparing your downloads…
            </div>
          )}
          {fullRes.data?.map((image, i) => (
            <Button key={image.id} asChild variant="outline" className="self-start">
              <a href={image.fullUrl} download data-testid="headshot-download-link">
                <Download className="mr-2 h-4 w-4" aria-hidden />
                Download headshot {i + 1}
              </a>
            </Button>
          ))}
        </div>
      ) : (
        <Button
          type="button"
          className="self-start"
          disabled={unlock.isPending}
          onClick={() =>
            unlock.mutate(undefined, {
              onError: (err) => toast.error(err.message),
            })
          }
          data-testid="headshot-unlock-button"
        >
          {unlock.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Lock className="mr-2 h-4 w-4" aria-hidden />
          )}
          Unlock ($5)
        </Button>
      )}
    </div>
  );
}
