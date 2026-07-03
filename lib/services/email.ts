import { Resend } from 'resend';
import { type EmailTemplateName, emailTemplates } from '@/lib/email/templates';
import type { Result } from '@/lib/result';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  templateName: EmailTemplateName;
  templateProps?: Record<string, any>;
  from?: string;
}

export class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com';
  }

  private ensureInitialized(): void {
    if (!this.apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required to send emails');
    }
    if (!this.resend) {
      this.resend = new Resend(this.apiKey);
    }
  }

  async sendEmail(options: EmailOptions): Promise<Result<{ id: string }>> {
    try {
      this.ensureInitialized();

      const Template = emailTemplates[options.templateName];

      const result = await this.resend!.emails.send({
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        react: Template((options.templateProps || {}) as any),
      });

      if (result.error) {
        return {
          success: false,
          error: {
            code: 'EXTERNAL_SERVICE_ERROR',
            message: result.error.message,
            cause: result.error,
          },
        };
      }

      return { success: true, data: { id: result.data?.id || '' } };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          cause: error,
        },
      };
    }
  }
}

/**
 * Factory function to create an EmailService instance.
 * Use this in tests if needed.
 */
export function createEmailService(): EmailService {
  return new EmailService();
}

/**
 * Singleton instance for production use.
 * Import this directly in API routes.
 */
export const emailService = new EmailService();
