import { withAuth } from '@/lib/api/handlers';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import type { RecordConsentResult } from '@/modules/headshot/types';

// POST /api/headshot/consent — record explicit biometric consent for the
// currently signed-in (email-verified) user.
export const POST = withAuth<RecordConsentResult>(async (session) => {
  return headshotService.recordBiometricConsent(session.user.id);
});
