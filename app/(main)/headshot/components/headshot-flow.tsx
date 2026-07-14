'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_STYLE_ID } from '@/modules/headshot/styles';
import type { HeadshotJob, HeadshotPreviewDTO } from '@/modules/headshot/types';
import { useHeadshotGenerate } from '../hooks/use-headshot-generate';
import { HeadshotResults } from './headshot-results';
import { HeadshotUploader } from './headshot-uploader';
import { StylePicker } from './style-picker';

/**
 * Client-side stepper for the full headshot flow:
 *   upload → pick a style (default pre-selected) → generate → previews.
 *
 * Generation is synchronous; loading/error state is driven off the mutation.
 * The one-tap requirement is met because a default style is always selected,
 * so "Generate" is enabled immediately with no prior style tap required.
 */
export function HeadshotFlow() {
  const [job, setJob] = useState<HeadshotJob | null>(null);
  const [styleId, setStyleId] = useState<string>(DEFAULT_STYLE_ID);
  const [previews, setPreviews] = useState<HeadshotPreviewDTO[] | null>(null);
  const generate = useHeadshotGenerate();

  const startGenerate = () => {
    if (!job) return;
    setPreviews(null);
    generate.mutate(
      { jobId: job.id, styleId },
      {
        onSuccess: (data) => {
          setJob(data.job);
          setPreviews(data.previews);
          toast.success('Your headshots are ready!');
        },
        onError: (err) => {
          toast.error(err.message);
        },
      },
    );
  };

  // Results shown — final step.
  if (previews) {
    return (
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Your headshot previews</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <HeadshotResults previews={previews} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPreviews(null);
            }}
          >
            Try a different style
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not uploaded yet — show the uploader.
  if (!job) {
    return <HeadshotUploader onJobCreated={setJob} />;
  }

  // Uploaded — style picker + generate + in-progress/failure states.
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Choose a style</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <StylePicker selectedId={styleId} onSelect={setStyleId} disabled={generate.isPending} />

        {generate.isPending ? (
          // biome-ignore lint/a11y/useSemanticElements: a polite live status region, not an <output> for a form result.
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Generating your headshots — this can take up to a minute…
          </div>
        ) : (
          <Button type="button" onClick={startGenerate} className="self-start">
            Generate
          </Button>
        )}

        {generate.isError && !generate.isPending && (
          <div
            className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4"
            role="alert"
          >
            <p className="text-sm text-destructive">
              We couldn&apos;t generate your headshots. Please try again.
            </p>
            <Button type="button" variant="outline" className="self-start" onClick={startGenerate}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
