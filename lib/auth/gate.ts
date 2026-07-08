import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user as userTable } from '@/modules/users/schema';

export interface VerifiedConsentedUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  biometricConsentAt: Date | null;
}

/**
 * Reason a visitor was bounced off the gated flow — surfaced to onboarding
 * so we can show the right message and step.
 */
export type GateReason = 'unauthenticated' | 'unverified' | 'unconsented';

/**
 * Returns the current user only if they are BOTH email-verified AND have
 * recorded biometric consent. Returns `null` otherwise (no redirect).
 * Later slices call this to decide whether generation is allowed.
 */
export async function getVerifiedConsentedUser(): Promise<VerifiedConsentedUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const [row] = await db()
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!row) return null;
  if (!row.emailVerified) return null;
  if (!row.biometricConsentAt) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
    biometricConsentAt: row.biometricConsentAt,
  };
}

/**
 * Server-side guard for gated pages (e.g. the generation flow). Redirects the
 * visitor back to onboarding with a `reason` when they are unauthenticated,
 * unverified, or unconsented. Returns the user when fully gated-through.
 */
export async function requireVerifiedConsented(): Promise<VerifiedConsentedUser> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/headshot/onboarding?reason=unauthenticated');
  }

  const [row] = await db()
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!row || !row.emailVerified) {
    redirect('/headshot/onboarding?reason=unverified');
  }

  if (!row.biometricConsentAt) {
    redirect('/headshot/onboarding?reason=unconsented');
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
    biometricConsentAt: row.biometricConsentAt,
  };
}
