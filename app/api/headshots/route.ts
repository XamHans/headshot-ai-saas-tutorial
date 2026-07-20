import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api/handlers';
import { db } from '@/lib/db';
import type { Result } from '@/lib/result';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import type { CreateJobInput, HeadshotJob } from '@/modules/headshot/types';
import { user as userTable } from '@/modules/users/schema';

// POST /api/headshots — upload a source photo, run the pre-flight face gate,
// and (on pass) create a pending headshot job with the source stored in R2.
//
// Auth: `withAuth` requires a session; we additionally enforce the slice-01
// verified + consented gate here (server-side, not just in the UI) so a photo
// can never be uploaded by an unverified/unconsented account.
export const POST = withAuth<HeadshotJob>(async (session, req) => {
  // Verified + consented guard (mirrors lib/auth/gate.ts, enforced in-route).
  const [row] = await db()
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!row || !row.emailVerified) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Please verify your email before uploading.' },
    } satisfies Result<HeadshotJob>;
  }
  if (!row.biometricConsentAt) {
    return {
      success: false,
      error: {
        code: 'CONSENT_REQUIRED',
        message: 'Biometric consent is required before uploading.',
      },
    } satisfies Result<HeadshotJob>;
  }

  // Parse the multipart upload. Keep parsing in the route; the service takes a
  // plain buffer + metadata and stays framework-agnostic.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Expected a multipart/form-data upload.' },
    } satisfies Result<HeadshotJob>;
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No image file was provided.' },
    } satisfies Result<HeadshotJob>;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const input: CreateJobInput = {
    buffer,
    contentType: file.type,
    filename: file.name,
    size: buffer.byteLength,
  };

  return headshotService.createJob(input, session.user.id);
});
