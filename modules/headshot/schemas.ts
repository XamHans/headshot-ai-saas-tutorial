import { z } from 'zod';

/**
 * Email entered at the onboarding step. The disposable-domain policy is
 * enforced in the service (so it can return a friendly top-level message);
 * here we only validate that the value is a well-formed email.
 */
export const requestMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
});

export type RequestMagicLinkSchema = z.infer<typeof requestMagicLinkSchema>;
