import type { AgeRule, Requirement, RequirementCheck } from '@/lib/schemas';

/**
 * The rule that decides each requirement.
 *
 * A requirement with a check is decided by the confirmed profile. One
 * without is left as the agent recorded it, because it depends on
 * something the profile cannot answer — whether the student needs a visa
 * sponsor, whether a university has published an annex.
 *
 * `blocking` says whether an unresolved requirement downgrades
 * eligibility, or only raises a warning.
 */
export const REQUIREMENT_RULES: Record<
  string,
  { check: RequirementCheck | null; blocking: boolean; ageRule?: AgeRule | null }
> = {
  // Helios Research Fellowship
  '50000000-0000-4000-8000-000000000001': {
    check: { factKey: 'degree_level', kind: 'at_least', value: 2, unit: 'degree level' },
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000002': {
    check: { factKey: 'field', kind: 'present' },
    blocking: false,
  },
  '50000000-0000-4000-8000-000000000003': {
    check: { factKey: 'nationality', kind: 'in_list', values: ['DZ', 'MA', 'TN', 'EG', 'JO'] },
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000004': {
    check: { factKey: 'english_level', kind: 'at_least', value: 6.5, unit: 'IELTS band' },
    blocking: true,
  },

  // Meridian AI Summer School
  '50000000-0000-4000-8000-000000000005': {
    check: { factKey: 'degree_level', kind: 'at_least', value: 2, unit: 'degree level' },
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000006': {
    // Whether the student needs a visa sponsor is not a profile fact.
    check: null,
    blocking: false,
  },

  // Atlas Global Graduate Scholarship
  '50000000-0000-4000-8000-000000000007': {
    check: null,
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000008': {
    check: { factKey: 'english_level', kind: 'at_least', value: 6.5, unit: 'IELTS band' },
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000009': {
    check: null,
    blocking: false,
  },

  // Rivermouth Institute Research Internship
  '50000000-0000-4000-8000-000000000010': {
    check: { factKey: 'degree_level', kind: 'at_least', value: 2, unit: 'degree level' },
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000011': {
    // Work authorisation in the host country cannot be read from a profile.
    check: null,
    blocking: true,
  },

  // Sable Foundation Fellowship
  '50000000-0000-4000-8000-000000000012': {
    // The eligible-country annex has not been published.
    check: null,
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000013': {
    check: { factKey: 'field', kind: 'present' },
    blocking: false,
  },

  // Verdant Climate Data Fellowship
  '50000000-0000-4000-8000-000000000014': {
    check: { factKey: 'degree_level', kind: 'at_least', value: 2, unit: 'degree level' },
    blocking: true,
  },
  '50000000-0000-4000-8000-000000000015': {
    check: { factKey: 'skills', kind: 'present' },
    blocking: false,
  },

  // Northwind Summer Research Programme
  '50000000-0000-4000-8000-000000000016': {
    // Nothing was extracted: the source could not be reached.
    check: null,
    blocking: true,
  },

  // Meridian AI Summer School — an age rule the model extracted, with the
  // date the age is measured on taken from the programme start.
  '50000000-0000-4000-8000-000000000017': {
    check: null,
    blocking: false,
    ageRule: {
      kind: 'min_age',
      minAge: 18,
      maxAge: null,
      eligibilityDate: '2027-07-01',
      sourceTitle: 'Meridian AI Summer School 2027 — official programme page',
      sourceUrl: 'https://meridian-ai.eu/summer-school',
      verification: 'verified',
    },
  },

  // Sable Foundation Fellowship — two sources state different age rules, so
  // the conflict is preserved rather than resolved silently.
  '50000000-0000-4000-8000-000000000018': {
    check: null,
    blocking: false,
    ageRule: {
      kind: 'max_age',
      minAge: null,
      maxAge: 30,
      eligibilityDate: '2026-12-15',
      sourceTitle: 'Sable Foundation Fellowship 2027 — official call',
      sourceUrl: 'https://sable-foundation.org/fellowships/2027',
      verification: 'conflicting',
    },
  },
};

/** Applies the rule table to a set of requirements. */
export function withRules<
  T extends { requirements: Omit<Requirement, 'check' | 'blocking' | 'ageRule'>[] },
>(input: T): Omit<T, 'requirements'> & { requirements: Requirement[] } {
  return {
    ...input,
    requirements: input.requirements.map((requirement) => ({
      ...requirement,
      check: REQUIREMENT_RULES[requirement.id]?.check ?? null,
      blocking: REQUIREMENT_RULES[requirement.id]?.blocking ?? true,
      ageRule: REQUIREMENT_RULES[requirement.id]?.ageRule ?? null,
    })),
  };
}
