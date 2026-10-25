import type { AlertCategory, AlertSensitivity, EmailCadence } from './schemas';

/**
 * The rule that decides whether an email may be sent.
 *
 * **This is the frozen backend rule, not an active interface.** The first
 * MVP delivers in-app alerts only; email is a later increment. The rule
 * lives here anyway, with its tests, so that the contract cannot drift
 * when email arrives: the backend implements the same decision, in the
 * same order, for the same reasons.
 *
 * Three separate things decide it, and they are kept apart on purpose:
 *
 * - **Consent** — "may Oppulse send email notifications at all?"
 * - **Preference** — "which emails do I want, and how often?"
 * - **Verification** — the backend has proved the student owns the address.
 *
 * A sensitive alert is never sent *with its content*, even to a verified
 * address: the message is a pointer back into the product. That keeps
 * profile, document and application data out of a mailbox we do not
 * control.
 */

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  deadline: 'Deadline changes',
  source_change: 'Source changes',
  run_complete: 'Research-run updates',
  application_task: 'Application tasks',
};

export const CADENCE_LABEL: Record<EmailCadence, string> = {
  off: 'No email',
  immediate: 'Immediate',
  daily_digest: 'Daily digest',
  weekly_digest: 'Weekly digest',
};

export type EmailDecision =
  { kind: 'send'; content: 'pointer' | 'full' } | { kind: 'suppress'; reason: string };

export interface EmailContext {
  /** May Oppulse send email notifications at all? */
  consent: boolean;
  /** The cadence the student chose for this category. */
  cadence: EmailCadence;
  /** Has the backend verified that the student owns the address? */
  emailVerified: boolean;
  category: AlertCategory;
  sensitivity: AlertSensitivity;
}

/**
 * Decides what happens to one alert on the email channel.
 *
 * The order matters: consent is a permission, the preference is the
 * student's own choice, and verification is the technical gate that remains
 * once both of those allow it.
 */
export function emailDecision(context: EmailContext): EmailDecision {
  if (!context.consent) {
    return {
      kind: 'suppress',
      reason: 'You have not agreed to email notifications.',
    };
  }

  if (context.cadence === 'off') {
    return {
      kind: 'suppress',
      reason: `You turned email off for ${CATEGORY_LABEL[context.category].toLowerCase()}.`,
    };
  }

  if (!context.emailVerified) {
    return {
      kind: 'suppress',
      reason: 'Your address is not verified, so nothing is sent to it.',
    };
  }

  // A sensitive alert travels as a pointer, never as its content.
  return { kind: 'send', content: context.sensitivity === 'sensitive' ? 'pointer' : 'full' };
}

/**
 * The plain-language state of one channel, for the interface.
 *
 * The in-app channel is never described as failing: an email failure is a
 * delivery failure, not a loss of the alert.
 */
export function deliveryLabel(input: {
  status: 'not_configured' | 'pending' | 'delivered' | 'failed' | 'suppressed';
  error: string | null;
  sensitivity: AlertSensitivity;
}): string {
  switch (input.status) {
    case 'delivered':
      return input.sensitivity === 'sensitive'
        ? 'Email sent — the detail stays in Oppulse'
        : 'Email sent';
    case 'pending':
      return 'Email queued for your digest';
    case 'failed':
      return input.error ?? 'Email failed';
    case 'suppressed':
      return input.error ?? 'No email was sent';
    case 'not_configured':
    default:
      return 'Email is not set up';
  }
}
