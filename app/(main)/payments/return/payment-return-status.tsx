'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useJobUnlockPoll } from './use-job-unlock-poll';

/**
 * Client-side reconciliation for a headshot unlock. Reads `session_id` from the
 * URL (appended by Stripe to `success_url`) and polls the job's unlock status
 * until the webhook lands, then shows a link back to the results.
 *
 * For a non-headshot payment (no `session_id`, or the session isn't a headshot
 * job) the poll is disabled / errors quietly and only the generic processing
 * copy is shown.
 */
export function PaymentReturnStatus() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { data } = useJobUnlockPoll(sessionId);

  if (!sessionId) return null;

  const unlocked = data?.unlocked === true;

  return (
    <div
      className="rounded-lg border p-4"
      data-testid="unlock-status"
      data-unlocked={unlocked ? 'true' : 'false'}
    >
      {unlocked ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Your full-resolution headshots are unlocked.
          </div>
          <Button asChild className="w-full">
            <Link href="/headshot">View &amp; download your headshots</Link>
          </Button>
        </div>
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: polite live status region, not a form output.
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Confirming your payment and unlocking your downloads…
        </div>
      )}
    </div>
  );
}
