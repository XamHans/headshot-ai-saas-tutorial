import { Suspense } from 'react';
import { requireVerifiedConsented } from '@/lib/auth/gate';
import { DeleteMyData } from './components/delete-my-data';
import { HeadshotFlow } from './components/headshot-flow';

// Gated generation flow. The slice-01 gate redirects unauthenticated /
// unverified / unconsented visitors back to onboarding before they reach here.
// This slice adds the upload + pre-flight face gate step.
export default async function HeadshotPage() {
  const user = await requireVerifiedConsented();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Generate your headshots</h1>
        <p className="text-muted-foreground">
          Welcome, {user.email}. Upload a source photo to get started — we&apos;ll check it has a
          single, clear face before anything else.
        </p>
      </div>
      <Suspense fallback={null}>
        <HeadshotFlow />
      </Suspense>

      <div className="mt-4 flex flex-col gap-2 border-t pt-6">
        <h2 className="text-sm font-semibold">Your data</h2>
        <p className="text-sm text-muted-foreground">
          We automatically delete source photos and unpurchased previews after 30 days. You can also
          delete everything now.
        </p>
        <DeleteMyData />
      </div>
    </div>
  );
}
