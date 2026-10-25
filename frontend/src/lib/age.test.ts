import { describe, expect, it } from 'vitest';
import { ageOn, evaluateAgeRequirement, evaluateAgeRule, evaluateRequirement } from './matching';
import { parseDateOfBirth, PREFER_NOT_TO_SAY } from './date-of-birth';
import type { AgeRule, Requirement } from './schemas';

/**
 * Age-aware eligibility.
 *
 * The date of birth is sensitive and the model never does the arithmetic,
 * so the calculation is a pure function with a test for every edge: the
 * birthday that has not happened yet, the impossible date, the conflicting
 * rule, and the day the date is withdrawn.
 */

const MIN_18: AgeRule = {
  kind: 'min_age',
  minAge: 18,
  maxAge: null,
  eligibilityDate: '2027-07-01',
  sourceTitle: 'Meridian AI Summer School — official programme page',
  sourceUrl: 'https://meridian-ai.eu/summer-school',
  verification: 'verified',
};

const MAX_30: AgeRule = {
  kind: 'max_age',
  minAge: null,
  maxAge: 30,
  eligibilityDate: '2026-12-15',
  sourceTitle: 'Sable Foundation Fellowship — official call',
  sourceUrl: 'https://sable-foundation.org/fellowships/2027',
  verification: 'verified',
};

describe('ageOn', () => {
  it('counts the birthday that has already happened', () => {
    expect(ageOn('2004-03-12', '2027-07-01')).toBe(23);
  });

  it('does not count a birthday that has not happened yet', () => {
    // Born in December, measured in July: still 22, not 23.
    expect(ageOn('2004-12-20', '2027-07-01')).toBe(22);
  });

  it('counts the birthday on the day itself', () => {
    expect(ageOn('2004-07-01', '2027-07-01')).toBe(23);
  });

  it('handles a leap day', () => {
    expect(ageOn('2004-02-29', '2025-02-28')).toBe(20);
    expect(ageOn('2004-02-29', '2025-03-01')).toBe(21);
  });

  it('rejects a date that does not exist', () => {
    expect(ageOn('2004-02-31', '2027-07-01')).toBeNull();
  });

  it('rejects a malformed date', () => {
    expect(ageOn('12/03/2004', '2027-07-01')).toBeNull();
    expect(ageOn('not-a-date', '2027-07-01')).toBeNull();
  });

  it('rejects a birth date after the day it is measured on', () => {
    expect(ageOn('2030-01-01', '2027-07-01')).toBeNull();
  });
});

describe('evaluateAgeRule', () => {
  it('compares against a minimum age', () => {
    expect(evaluateAgeRule(18, MIN_18)).toBe('satisfied');
    expect(evaluateAgeRule(17, MIN_18)).toBe('not_satisfied');
  });

  it('compares against a maximum age', () => {
    expect(evaluateAgeRule(30, MAX_30)).toBe('satisfied');
    expect(evaluateAgeRule(31, MAX_30)).toBe('not_satisfied');
  });

  it('compares against a range', () => {
    const range: AgeRule = { ...MIN_18, kind: 'age_range', minAge: 18, maxAge: 24 };

    expect(evaluateAgeRule(21, range)).toBe('satisfied');
    expect(evaluateAgeRule(25, range)).toBe('not_satisfied');
  });
});

describe('evaluateAgeRequirement', () => {
  it('says an age requirement appears satisfied, without repeating the date', () => {
    const result = evaluateAgeRequirement('2004-03-12', MIN_18);

    expect(result.status).toBe('satisfied');
    expect(result.summary).toContain('appears satisfied');
    expect(result.summary).not.toContain('2004');
    expect(result.summary).not.toContain('2004-03-12');
  });

  it('says an age requirement is not satisfied when it is not', () => {
    const result = evaluateAgeRequirement('2012-03-12', MIN_18);

    expect(result.status).toBe('not_satisfied');
  });

  it('leaves it unresolved when the date was never given', () => {
    const result = evaluateAgeRequirement(null, MIN_18);

    expect(result.status).toBe('unresolved');
    expect(result.summary).toContain('not available');
  });

  it('preserves a conflict between two sources instead of choosing one', () => {
    const result = evaluateAgeRequirement('2004-03-12', { ...MAX_30, verification: 'conflicting' });

    expect(result.status).toBe('conflicting');
    expect(result.summary).toContain('different age rules');
  });

  it('leaves it unresolved while the official cutoff still needs verification', () => {
    const result = evaluateAgeRequirement('2004-03-12', {
      ...MIN_18,
      verification: 'needs_verification',
    });

    expect(result.status).toBe('unresolved');
    expect(result.summary).toContain('needs verification');
  });
});

describe('evaluateRequirement', () => {
  const ageRequirement: Requirement = {
    id: '50000000-0000-4000-8000-000000000017',
    label: 'Participants must be 18 or over at the start of the programme',
    kind: 'age',
    status: 'unresolved',
    sourceClause: 'The summer school is open to participants aged 18 and over.',
    evidenceIds: [],
    profileFactKey: null,
    check: null,
    ageRule: MIN_18,
    blocking: false,
    explanation: 'Not evaluated yet.',
  };

  const protectedProfile = {
    dateOfBirth: {
      value: '2004-03-12',
      status: 'provided' as const,
      source: null,
      updatedAt: '2026-10-19T09:00:00.000Z',
      excludedFromAiContext: false,
    },
  };

  it('decides an age requirement from the date, not from a fact', () => {
    const result = evaluateRequirement(ageRequirement, null, protectedProfile);

    expect(result.status).toBe('likely');
    expect(result.explanation).toContain('appears satisfied');
  });

  it('ignores the date when the student excluded it from use', () => {
    const result = evaluateRequirement(ageRequirement, null, {
      dateOfBirth: { ...protectedProfile.dateOfBirth, excludedFromAiContext: true },
    });

    expect(result.status).toBe('unresolved');
  });

  it('never puts the date into the explanation', () => {
    const result = evaluateRequirement(ageRequirement, null, protectedProfile);

    expect(result.explanation).not.toContain('2004');
  });
});

describe('parseDateOfBirth', () => {
  it('accepts an ISO date', () => {
    expect(parseDateOfBirth('2004-03-12')).toEqual({ iso: '2004-03-12' });
  });

  it('accepts a typed day-first date', () => {
    expect(parseDateOfBirth('12/03/2004')).toEqual({ iso: '2004-03-12' });
  });

  it('rejects an impossible date', () => {
    const result = parseDateOfBirth('31/02/2004');

    expect(result).toEqual({ error: 'That date does not exist.' });
  });

  it('rejects a date in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    expect(parseDateOfBirth(future)).toEqual({
      error: 'A date of birth cannot be in the future.',
    });
  });

  it('rejects a format it cannot read', () => {
    expect(parseDateOfBirth('12 March 2004')).toEqual({
      error: 'Use YYYY-MM-DD, or DD/MM/YYYY.',
    });
  });

  it('treats an empty answer as no answer', () => {
    expect(parseDateOfBirth('  ')).toBeNull();
  });

  it('has a value for "prefer not to say" that is not a date', () => {
    expect(parseDateOfBirth(PREFER_NOT_TO_SAY)).toEqual({
      error: 'Use YYYY-MM-DD, or DD/MM/YYYY.',
    });
  });
});
