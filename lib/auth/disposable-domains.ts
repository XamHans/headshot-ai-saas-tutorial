/**
 * Static list of known disposable / throwaway email domains.
 *
 * Used at signup to reject temporary inboxes so the headshot funnel only
 * onboards people who can actually receive their generated results.
 * Kept as a plain array so it is trivially extendable and diff-reviewable.
 */
export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'grr.la',
  'sharklasers.com',
  'spam4.me',
  'tempmail.com',
  'temp-mail.org',
  'throwam.com',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'maildrop.cc',
  'mailnull.com',
  'spamgourmet.com',
  'getnada.com',
  'dispostable.com',
  'fakeinbox.com',
  'mintemail.com',
  'mohmal.com',
  '10minutemail.com',
  '10minutemail.net',
  'emailondeck.com',
  'mailcatch.com',
  'inboxbear.com',
  'tempinbox.com',
];

const disposableSet = new Set(DISPOSABLE_EMAIL_DOMAINS);

/**
 * Returns true when the email's domain is a known disposable/throwaway domain.
 */
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return disposableSet.has(domain);
}
