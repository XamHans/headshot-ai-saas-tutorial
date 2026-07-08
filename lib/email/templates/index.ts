import { MagicLinkEmail } from './magic-link';
import { WelcomeEmail } from './welcome';

export const emailTemplates = {
  welcome: WelcomeEmail,
  'magic-link': MagicLinkEmail,
} as const;

export type EmailTemplateName = keyof typeof emailTemplates;
