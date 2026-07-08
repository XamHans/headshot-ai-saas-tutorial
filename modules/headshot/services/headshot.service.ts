import { eq } from 'drizzle-orm';
import { isDisposableEmail } from '@/lib/auth/disposable-domains';
import type { Result } from '@/lib/result';
import { getServiceContext, type ServiceContext } from '@/lib/services';
import { user } from '@/modules/users/schema';
import type { RecordConsentResult, RequestMagicLinkResult } from '../types';

/**
 * Business logic for the onboarding gate: guards magic-link requests against
 * disposable domains and persists biometric consent against the account.
 *
 * The actual magic-link dispatch + email verification is owned by Better Auth
 * (see `lib/auth.ts`); this service adds the disposable-domain policy and the
 * consent persistence that Better Auth doesn't know about.
 */
export class HeadshotService {
  constructor(private ctx: ServiceContext) {}

  private get logger() {
    return this.ctx.logger.child({ service: 'HeadshotService' });
  }

  /**
   * Policy check performed before any magic link is sent or account created.
   * Returns an error Result for disposable domains so the caller can bail
   * before touching Better Auth.
   */
  assertOnboardableEmail(email: string): Result<RequestMagicLinkResult> {
    if (isDisposableEmail(email)) {
      this.logger.info('Rejected disposable email at onboarding', {
        operation: 'assertOnboardableEmail',
      });
      return {
        success: false,
        error: {
          code: 'DISPOSABLE_EMAIL',
          message:
            'Please use a real, permanent email address — disposable inboxes are not allowed.',
        },
      };
    }
    return { success: true, data: { sent: true } };
  }

  /**
   * Records explicit biometric consent for a verified user by stamping
   * `biometricConsentAt`. Idempotent — re-consenting refreshes the timestamp.
   */
  async recordBiometricConsent(userId: string): Promise<Result<RecordConsentResult>> {
    this.logger.info('Recording biometric consent', {
      operation: 'recordBiometricConsent',
      userId,
    });

    try {
      const consentedAt = new Date();
      const [updated] = await this.ctx.db
        .update(user)
        .set({ biometricConsentAt: consentedAt, updatedAt: consentedAt })
        .where(eq(user.id, userId))
        .returning();

      if (!updated) {
        return {
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        };
      }

      return {
        success: true,
        data: { biometricConsentAt: consentedAt.toISOString() },
      };
    } catch (error) {
      this.logger.error('Failed to record biometric consent', {
        error,
        operation: 'recordBiometricConsent',
        userId,
      });
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to record consent',
          cause: error,
        },
      };
    }
  }
}

/**
 * Factory for tests — inject a test ServiceContext.
 */
export function createHeadshotService(ctx: ServiceContext): HeadshotService {
  return new HeadshotService(ctx);
}

/**
 * Singleton for production use — import this directly in API routes.
 */
export const headshotService = new HeadshotService(getServiceContext());
