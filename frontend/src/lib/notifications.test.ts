import { describe, expect, it } from 'vitest';
import { deliveryLabel, emailDecision, CADENCE_LABEL, CATEGORY_LABEL } from './notifications';

/**
 * The email rule.
 *
 * Three separate things decide whether an email may be sent — consent, the
 * student's own preference, and whether the address is verified — and the
 * order matters, because the reason shown to the student has to be the one
 * they can act on.
 */

const BASE = {
  consent: true,
  cadence: 'immediate' as const,
  emailVerified: true,
  category: 'deadline' as const,
  sensitivity: 'routine' as const,
};

describe('emailDecision', () => {
  it('sends a routine alert to a verified address', () => {
    expect(emailDecision(BASE)).toEqual({ kind: 'send', content: 'full' });
  });

  it('sends a sensitive alert as a pointer, never with its content', () => {
    expect(emailDecision({ ...BASE, sensitivity: 'sensitive' })).toEqual({
      kind: 'send',
      content: 'pointer',
    });
  });

  it('sends nothing when the student has not agreed to email at all', () => {
    const decision = emailDecision({ ...BASE, consent: false });

    expect(decision.kind).toBe('suppress');
    expect(decision.kind === 'suppress' && decision.reason).toBe(
      'You have not agreed to email notifications.',
    );
  });

  it('sends nothing when the student turned this category off', () => {
    const decision = emailDecision({ ...BASE, cadence: 'off' });

    expect(decision.kind).toBe('suppress');
    expect(decision.kind === 'suppress' && decision.reason).toContain(
      CATEGORY_LABEL.deadline.toLowerCase(),
    );
  });

  it('sends nothing to an unverified address', () => {
    const decision = emailDecision({ ...BASE, emailVerified: false });

    expect(decision.kind).toBe('suppress');
    expect(decision.kind === 'suppress' && decision.reason).toContain('not verified');
  });

  it('never emails a sensitive alert to an unverified address', () => {
    const decision = emailDecision({
      ...BASE,
      emailVerified: false,
      sensitivity: 'sensitive',
    });

    expect(decision.kind).toBe('suppress');
  });

  it('reports the consent problem before the address problem', () => {
    const decision = emailDecision({ ...BASE, consent: false, emailVerified: false });

    expect(decision.kind === 'suppress' && decision.reason).toContain('not agreed');
  });

  it("reports the student's own choice before the address problem", () => {
    const decision = emailDecision({
      ...BASE,
      cadence: 'off',
      emailVerified: false,
    });

    expect(decision.kind === 'suppress' && decision.reason).toContain('You turned email off');
  });
});

describe('deliveryLabel', () => {
  it('says a sensitive email carries no detail', () => {
    expect(deliveryLabel({ status: 'delivered', error: null, sensitivity: 'sensitive' })).toBe(
      'Email sent — the detail stays in Oppulse',
    );
  });

  it('says a routine email was simply sent', () => {
    expect(deliveryLabel({ status: 'delivered', error: null, sensitivity: 'routine' })).toBe(
      'Email sent',
    );
  });

  it('keeps a queued email distinct from a sent one', () => {
    expect(deliveryLabel({ status: 'pending', error: null, sensitivity: 'routine' })).toBe(
      'Email queued for your digest',
    );
  });

  it('shows the provider reason when an email failed', () => {
    expect(
      deliveryLabel({
        status: 'failed',
        error: 'The mail provider rejected the message.',
        sensitivity: 'routine',
      }),
    ).toBe('The mail provider rejected the message.');
  });

  it('shows why an email was suppressed', () => {
    expect(
      deliveryLabel({
        status: 'suppressed',
        error: 'Your address is not verified, so nothing is sent to it.',
        sensitivity: 'sensitive',
      }),
    ).toContain('not verified');
  });
});

describe('labels', () => {
  it('names every cadence in plain language', () => {
    expect(Object.keys(CADENCE_LABEL)).toEqual([
      'off',
      'immediate',
      'daily_digest',
      'weekly_digest',
    ]);
  });
});
