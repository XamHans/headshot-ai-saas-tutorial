'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/lib/auth-client';
import { useRecordConsent, useRequestMagicLink } from '../hooks/use-onboarding';

const GATE_MESSAGES: Record<string, string> = {
  unauthenticated: 'Please verify your email to continue.',
  unverified: 'Email verification is required before you can generate headshots.',
  unconsented: 'Please grant biometric consent before generating headshots.',
};

export function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const { data: session, isPending: sessionPending } = useSession();

  const requestLink = useRequestMagicLink();
  const recordConsent = useRecordConsent();

  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const consentId = useId();
  const emailId = useId();

  const gateMessage = reason ? GATE_MESSAGES[reason] : null;

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    requestLink.mutate(email, {
      onSuccess: () => {
        setLinkSent(true);
        toast.success('Check your email for a verification link.');
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  };

  const handleConsent = async () => {
    recordConsent.mutate(undefined, {
      onSuccess: () => {
        toast.success('Consent recorded. Redirecting…');
        router.push('/headshot');
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  };

  // Authenticated (email verified via magic link) -> consent step.
  const isAuthenticated = !sessionPending && !!session?.user;

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {gateMessage && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {gateMessage}
        </div>
      )}

      {isAuthenticated ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">One last step</CardTitle>
            <CardDescription>
              We need your explicit consent to process your photo as biometric data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id={consentId}
                aria-label="biometric consent"
                checked={consentChecked}
                onCheckedChange={(v) => setConsentChecked(v === true)}
              />
              <Label htmlFor={consentId} className="text-sm font-normal leading-relaxed">
                I consent to my photo being processed as biometric data to generate headshots.
              </Label>
            </div>
            <Button
              className="w-full"
              disabled={!consentChecked || recordConsent.isPending}
              onClick={handleConsent}
            >
              {recordConsent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving consent…
                </>
              ) : (
                'I consent — continue'
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Get your AI headshots</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a secure link to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkSent ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Check your email</p>
                <p>
                  We sent a verification link to <span className="font-medium">{email}</span>. Click
                  it to verify your email and continue.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={emailId}>Email</Label>
                  <Input
                    id={emailId}
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={requestLink.isPending}>
                  {requestLink.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send magic link'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
