import { requireVerifiedConsented } from '@/lib/auth/gate';
import { HeadshotUploader } from './components/headshot-uploader';

// Gated generation flow. The slice-01 gate redirects unauthenticated /
// unverified / unconsented visitors back to onboarding before they reach here.
// This slice adds the upload + pre-flight face gate step.
export default async function HeadshotPage() {
  const user = await requireVerifiedConsented();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Generate your headshots</h1>
        <p className="text-muted-foreground">
          Welcome, {user.email}. Upload a source photo to get started — we&apos;ll check it has a
          single, clear face before anything else.
        </p>
      </div>
      <HeadshotUploader />
    </div>
  );
}
