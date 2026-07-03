import { WelcomeEmail } from './welcome';

export const emailTemplates = {
  welcome: WelcomeEmail,
} as const;

export type EmailTemplateName = keyof typeof emailTemplates;
