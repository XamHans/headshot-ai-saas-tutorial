import { z } from 'zod';
import { HEADSHOT_STYLES } from './styles';

/**
 * Email entered at the onboarding step. The disposable-domain policy is
 * enforced in the service (so it can return a friendly top-level message);
 * here we only validate that the value is a well-formed email.
 */
export const requestMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
});

export type RequestMagicLinkSchema = z.infer<typeof requestMagicLinkSchema>;

/**
 * Upload constraints for a source headshot photo. Shared by the client
 * (instant feedback via `fileUploadService.validateFile`) and the server
 * (authoritative re-validation in the service). Keep these in sync — the
 * server never trusts the client's own check.
 */
export const HEADSHOT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const HEADSHOT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const HEADSHOT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

/**
 * Server-side validation of the parsed upload metadata (not the pixels — the
 * face gate handles those). Enforces exactly-one image of an allowed type and
 * size. Pixel-level checks happen in the service after this passes.
 */
export const createJobInputSchema = z.object({
  contentType: z
    .string()
    .refine(
      (t) => (HEADSHOT_ALLOWED_MIME_TYPES as readonly string[]).includes(t),
      'Only JPEG or PNG images are allowed.',
    ),
  filename: z
    .string()
    .min(1, 'A filename is required.')
    .refine((name) => {
      const ext = `.${name.split('.').pop()?.toLowerCase() ?? ''}`;
      return (HEADSHOT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
    }, 'Only .jpg, .jpeg, or .png files are allowed.'),
  size: z
    .number()
    .int()
    .positive('The uploaded file is empty.')
    .max(HEADSHOT_MAX_FILE_SIZE, 'Image must be 10MB or smaller.'),
});

export type CreateJobInputSchema = z.infer<typeof createJobInputSchema>;

/**
 * Body of `POST /api/headshots/[id]/generate`. `styleId` must be one of the
 * known v1 presets; unknown ids are rejected at the boundary.
 */
const STYLE_IDS = HEADSHOT_STYLES.map((s) => s.id) as [string, ...string[]];

export const generateSetSchema = z.object({
  styleId: z.enum(STYLE_IDS, {
    errorMap: () => ({ message: 'Unknown style.' }),
  }),
});

export type GenerateSetSchema = z.infer<typeof generateSetSchema>;
