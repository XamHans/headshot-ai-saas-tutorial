import { requireVerifiedConsented } from '@/lib/auth/gate';

// Placeholder for the generation flow (built in later slices). It exists here
// only to prove the gate works: unauthenticated / unverified / unconsented
// visitors are redirected back to onboarding before they can reach it.
export default async function HeadshotPage() {
  const user = await requireVerifiedConsented();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold tracking-tight">Generate your headshots</h1>
      <p className="text-muted-foreground">
        Welcome, {user.email}. Your email is verified and biometric consent is recorded — the upload
        and generation flow lands here in the next slice.
      </p>
    </div>
  );
}
