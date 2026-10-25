import type { Profile, ProfileFact } from './schemas';
import { REQUIRED_FACTS, REQUIRED_FACT_KEYS } from './matching';

/**
 * Profile completeness.
 *
 * Not "how much have you filled in" — how much of what the agent actually
 * needs in order to assess an application is *confirmed*. A field the
 * student has not confirmed is not usable, so it does not count.
 */

export interface MissingFact {
  key: string;
  label: string;
  usedFor: string;
}

export interface ProfileCompleteness {
  /** How many of the required facts are confirmed. */
  confirmed: number;
  /** How many facts the agent needs. */
  required: number;
  /** 0–100. */
  percent: number;
  /** Required facts that exist but are not confirmed yet. */
  pending: ProfileFact[];
  /** Required facts that are absent entirely. */
  missing: MissingFact[];
  /** A plain-language summary, never a bare number. */
  summary: string;
}

export function computeCompleteness(profile: Profile | null | undefined): ProfileCompleteness {
  const facts = profile?.facts ?? [];

  const confirmed = REQUIRED_FACT_KEYS.filter((key) => {
    const fact = facts.find((candidate) => candidate.key === key);
    return fact?.status === 'confirmed' && !fact.excluded;
  }).length;

  const pending = facts.filter(
    (fact) =>
      REQUIRED_FACT_KEYS.includes(fact.key as (typeof REQUIRED_FACT_KEYS)[number]) &&
      fact.status !== 'confirmed' &&
      !fact.excluded,
  );

  const missing: MissingFact[] = REQUIRED_FACTS.filter(
    (required) => !facts.some((fact) => fact.key === required.key && !fact.excluded),
  ).map((required) => ({
    key: required.key,
    label: required.label,
    usedFor: required.usedFor,
  }));

  const required = REQUIRED_FACT_KEYS.length;
  const percent = Math.round((confirmed / required) * 100);

  let summary: string;
  if (confirmed === required) {
    summary = 'Everything Oppulse needs to assess an application is confirmed.';
  } else if (pending.length > 0 && missing.length > 0) {
    summary = `${confirmed} of ${required} confirmed. ${pending.length} waiting for you, ${missing.length} still missing.`;
  } else if (pending.length > 0) {
    summary = `${confirmed} of ${required} confirmed. ${pending.length === 1 ? 'one fact is' : 'facts are'} waiting for you.`;
  } else {
    summary = `${confirmed} of ${required} confirmed. ${missing.length === 1 ? 'one thing is' : 'things are'} still missing.`;
  }

  return { confirmed, required, percent, pending, missing, summary };
}
