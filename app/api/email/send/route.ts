import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/handlers';
import { parseRequestBody } from '@/lib/validation/parse';
import { emailService } from '@/lib/services/email';
import { type EmailTemplateName, emailTemplates } from '@/lib/email/templates';
import { z } from 'zod';

// Helper to get template names at runtime
const templateNames = Object.keys(emailTemplates) as [string, ...string[]];

const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  templateName: z.enum(templateNames).transform((val) => val as EmailTemplateName),
  templateProps: z.record(z.any()).optional(),
});

export const POST = withAuth(async (session, request: NextRequest) => {
  const bodyResult = await parseRequestBody(request, sendEmailSchema);
  if (!bodyResult.success) return bodyResult;

  const { to, subject, templateName, templateProps } = bodyResult.data;

  const result = await emailService.sendEmail({
    to,
    subject,
    templateName,
    templateProps,
  });

  if (!result.success) return result;

  return {
    success: true,
    data: {
      message: 'Email sent successfully',
      emailId: result.data.id,
    },
  };
});
