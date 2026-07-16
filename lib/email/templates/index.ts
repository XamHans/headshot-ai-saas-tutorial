import { HeadshotResultsEmail } from './headshot-results';
import { MagicLinkEmail } from './magic-link';
import { WelcomeEmail } from './welcome';

export const emailTemplates = {
  welcome: WelcomeEmail,
  'magic-link': MagicLinkEmail,
  'headshot-results': HeadshotResultsEmail,
} as const;

export type EmailTemplateName = keyof typeof emailTemplates;
