import type {
  AgeRule,
  Match,
  Opportunity,
  Profile,
  ProtectedProfile,
  Requirement,
} from './schemas';

/**
 * Eligibility matching.
 *
 * The agent proposes a requirement; a deterministic check decides it. That
 * split is what makes an eligibility answer explainable and reproducible:
 * the same confirmed facts always produce the same verdict, and the verdict
 * can always be traced to the fact that produced it.
 *
 * This module is pure and shared: the mock, the client and (later) the
 * backend all reach the same conclusion rather than three copies of the
 * same rule drifting apart.
 */

/** The facts the agent genuinely needs in order to assess an application. */
export const REQUIRED_FACT_KEYS = [
  'degree_level',
  'field',
  'graduation_year',
  'nationality',
  'english_level',
  'skills',
] as const;

export interface RequiredFact {
  key: string;
  label: string;
  usedFor: string;
}

/** What each required fact is for, in plain language. */
export const REQUIRED_FACTS: readonly RequiredFact[] = [
  {
    key: 'degree_level',
    label: 'Current degree level',
    usedFor: 'Decides which programme types you are eligible for.',
  },
  {
    key: 'field',
    label: 'Field of study',
    usedFor: 'Matches you against each programme’s research area and technical requirements.',
  },
  {
    key: 'graduation_year',
    label: 'Expected graduation',
    usedFor: 'Checks that your degree is complete in time for the programme start.',
  },
  {
    key: 'nationality',
    label: 'Nationality',
    usedFor: 'Checks the nationality and residency clauses in each call.',
  },
  {
    key: 'english_level',
    label: 'English proficiency',
    usedFor: 'Assesses the language requirement in each call.',
  },
  {
    key: 'skills',
    label: 'Technical skills',
    usedFor: 'Checks the software and method requirements a call lists.',
  },
];

function findFact(profile: Profile | null | undefined, key: string) {
  return profile?.facts.find((fact) => fact.key === key);
}

function sourceName(fact: { source: { documentName: string } | null }): string | null {
  return fact.source?.documentName ?? null;
}

/* ------------------------------------------------------------------ */
/* Age                                                                 */
/* ------------------------------------------------------------------ */

/** The outcome of an age check. */
export type AgeEligibility = 'satisfied' | 'not_satisfied' | 'unresolved' | 'conflicting';

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Parses `YYYY-MM-DD` as a plain calendar date.
 *
 * The parts are read in UTC so that a timezone never shifts a birthday by a
 * day. Returns null for anything that is not a real date.
 */
function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // A round trip through UTC rejects 31 February and friends.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/**
 * The age of a person on a given date.
 *
 * It is not "this year minus the birth year": the birthday has to have
 * happened. A student who turns 18 in September is 17 on 1 July.
 */
export function ageOn(dateOfBirth: string, onDate: string): number | null {
  const birth = parseCalendarDate(dateOfBirth);
  const on = parseCalendarDate(onDate);
  if (!birth || !on) return null;

  let age = on.year - birth.year;
  if (on.month < birth.month || (on.month === birth.month && on.day < birth.day)) {
    age -= 1;
  }

  return age < 0 ? null : age;
}

/**
 * Compares an age against an official rule.
 *
 * The rule is always expressed in years, and always measured on the date
 * the source states.
 */
export function evaluateAgeRule(age: number, rule: AgeRule): 'satisfied' | 'not_satisfied' {
  switch (rule.kind) {
    case 'min_age':
      return rule.minAge !== null && age >= rule.minAge ? 'satisfied' : 'not_satisfied';
    case 'max_age':
      return rule.maxAge !== null && age <= rule.maxAge ? 'satisfied' : 'not_satisfied';
    case 'age_range': {
      const aboveMinimum = rule.minAge === null || age >= rule.minAge;
      const belowMaximum = rule.maxAge === null || age <= rule.maxAge;
      return aboveMinimum && belowMaximum ? 'satisfied' : 'not_satisfied';
    }
    default:
      return 'not_satisfied';
  }
}

export interface AgeRequirementResult {
  status: AgeEligibility;
  /** The age on the eligibility date, when it could be calculated. */
  age: number | null;
  /** One plain sentence for the interface. Never contains the birth date. */
  summary: string;
}

/**
 * Resolves an age requirement.
 *
 * The date of birth is only used here, and only when the student allowed
 * it. The result is an outcome — "appears satisfied", "unresolved" — never
 * the date itself, so the answer can be shown anywhere without leaking it.
 */
export function evaluateAgeRequirement(
  dateOfBirth: string | null,
  rule: AgeRule | null,
): AgeRequirementResult {
  if (!rule) {
    return {
      status: 'unresolved',
      age: null,
      summary: 'This call states an age condition, but the rule has not been read yet.',
    };
  }

  if (rule.verification === 'conflicting') {
    return {
      status: 'conflicting',
      age: null,
      summary: `Two sources state different age rules, so this one needs your review. The rule from ${rule.sourceTitle} is shown here.`,
    };
  }

  if (!dateOfBirth) {
    return {
      status: 'unresolved',
      age: null,
      summary:
        'Your date of birth is not available, so this age requirement stays unresolved. You can add it in your passport.',
    };
  }

  const age = ageOn(dateOfBirth, rule.eligibilityDate);
  if (age === null) {
    return {
      status: 'unresolved',
      age: null,
      summary: 'Your date of birth could not be read, so this age requirement stays unresolved.',
    };
  }

  const verdict = evaluateAgeRule(age, rule);

  if (rule.verification === 'needs_verification') {
    return {
      status: 'unresolved',
      age,
      summary: `The official cutoff in ${rule.sourceTitle} still needs verification, so this age requirement stays unresolved.`,
    };
  }

  return {
    status: verdict === 'satisfied' ? 'satisfied' : 'not_satisfied',
    age,
    summary:
      verdict === 'satisfied'
        ? `The age requirement appears satisfied. The rule is from ${rule.sourceTitle}, measured on ${rule.eligibilityDate}.`
        : `The age requirement is not satisfied by the rule in ${rule.sourceTitle}, measured on ${rule.eligibilityDate}.`,
  };
}

/**
 * Decides one requirement against the confirmed profile.
 *
 * A requirement with no check keeps the status the agent recorded — some
 * conditions (visa sponsorship, supervisor contact) are reasoned, not
 * computed. An age requirement is decided by the typed age service, never
 * by a fact and never by the model.
 */
export function evaluateRequirement(
  requirement: Requirement,
  profile: Profile | null | undefined,
  protectedProfile?: ProtectedProfile | null,
): Requirement {
  if (requirement.kind === 'age') {
    const dateOfBirth =
      protectedProfile && !protectedProfile.dateOfBirth.excludedFromAiContext
        ? protectedProfile.dateOfBirth.value
        : null;

    const result = evaluateAgeRequirement(dateOfBirth, requirement.ageRule);

    return {
      ...requirement,
      status:
        result.status === 'satisfied'
          ? 'likely'
          : result.status === 'not_satisfied'
            ? 'ineligible'
            : 'unresolved',
      explanation: result.summary,
    };
  }

  const check = requirement.check;
  if (!check) return requirement;

  const fact = findFact(profile, check.factKey);

  if (!fact) {
    return {
      ...requirement,
      status: 'unresolved',
      explanation: `Oppulse has no ${requirement.label.toLowerCase()} for you yet, so it cannot check this requirement.`,
    };
  }

  if (fact.excluded) {
    return {
      ...requirement,
      status: 'unresolved',
      explanation: `You excluded your ${fact.label.toLowerCase()} from AI use, so this requirement is not being checked.`,
    };
  }

  if (fact.status !== 'confirmed') {
    const from = sourceName(fact);
    return {
      ...requirement,
      status: 'unresolved',
      explanation: from
        ? `Your ${fact.label.toLowerCase()} was extracted from ${from} but you have not confirmed it, so this requirement stays unresolved.`
        : `Your ${fact.label.toLowerCase()} has not been confirmed, so this requirement stays unresolved.`,
    };
  }

  const verdict = runCheck(check, fact);

  if (verdict === 'met') {
    return {
      ...requirement,
      status: 'likely',
      explanation: `Your confirmed ${fact.label.toLowerCase()} — ${fact.value} — satisfies this requirement.`,
    };
  }

  return {
    ...requirement,
    status: 'ineligible',
    explanation: `Your confirmed ${fact.label.toLowerCase()} — ${fact.value} — does not meet this requirement.`,
  };
}

function runCheck(
  check: NonNullable<Requirement['check']>,
  fact: { numericValue: number | null; code: string | null; value: string },
): 'met' | 'not_met' {
  switch (check.kind) {
    case 'present':
      return fact.value.trim().length > 0 ? 'met' : 'not_met';

    case 'at_least': {
      if (fact.numericValue === null) return 'not_met';
      return fact.numericValue >= (check.value ?? 0) ? 'met' : 'not_met';
    }

    case 'in_list': {
      if (!fact.code) return 'not_met';
      return (check.values ?? []).includes(fact.code) ? 'met' : 'not_met';
    }

    default:
      return 'not_met';
  }
}

/** Re-evaluates every requirement of an opportunity. */
export function recomputeOpportunity(
  opportunity: Opportunity,
  profile: Profile | null | undefined,
  protectedProfile?: ProtectedProfile | null,
): Opportunity {
  return {
    ...opportunity,
    requirements: opportunity.requirements.map((requirement) =>
      evaluateRequirement(requirement, profile, protectedProfile),
    ),
  };
}

/**
 * Recomputes the assessment of one opportunity.
 *
 * The reasons the agent gives are kept — they are the narrative — while the
 * warnings are rebuilt from the requirements, so a card can never claim
 * "eligible" while a requirement is still unresolved.
 */
export function recomputeMatch(match: Match, opportunity: Opportunity): Match {
  const requirements = opportunity.requirements;
  const unresolved = requirements.filter(
    (requirement) => requirement.status === 'unresolved' && requirement.blocking,
  );
  const nonBlockingUnresolved = requirements.filter(
    (requirement) => requirement.status === 'unresolved' && !requirement.blocking,
  );
  const ineligible = requirements.filter((requirement) => requirement.status === 'ineligible');
  const decided = requirements.length - unresolved.length - ineligible.length;

  const eligibility: Match['eligibility'] =
    ineligible.length > 0 ? 'ineligible' : unresolved.length > 0 ? 'unresolved' : 'likely';

  const warnings = [
    ...unresolved.map((requirement) => `${requirement.label}: ${requirement.explanation}`),
    ...nonBlockingUnresolved.map(
      (requirement) => `${requirement.label}: ${requirement.explanation}`,
    ),
    ...ineligible.map((requirement) => `${requirement.label}: ${requirement.explanation}`),
  ];

  const ratio = requirements.length > 0 ? decided / requirements.length : 1;
  const confidence: Match['confidence'] = ratio >= 0.8 ? 'high' : ratio >= 0.5 ? 'medium' : 'low';

  return { ...match, eligibility, warnings, confidence };
}

/** Recomputes every opportunity and assessment against the current profile. */
export function recomputeAll(
  opportunities: Opportunity[],
  matches: Match[],
  profile: Profile | null | undefined,
  protectedProfile?: ProtectedProfile | null,
): { opportunities: Opportunity[]; matches: Match[] } {
  const nextOpportunities = opportunities.map((opportunity) =>
    recomputeOpportunity(opportunity, profile, protectedProfile),
  );

  const nextMatches = matches.map((match) => {
    const opportunity = nextOpportunities.find((candidate) => candidate.id === match.opportunityId);
    return opportunity ? recomputeMatch(match, opportunity) : match;
  });

  return { opportunities: nextOpportunities, matches: nextMatches };
}

/**
 * Which eligibility requirements are waiting on each fact.
 *
 * Only requirements that are still *blocking* are reported. A requirement
 * that the confirmed fact already settles is no longer holding anything up,
 * and listing it would tell the student they are still blocked when they
 * are not.
 *
 * This is what the passport shows under "Blocks", and it is the reason a
 * confirmation is worth making.
 */
export function buildImpact(opportunities: Opportunity[]): {
  factKey: string;
  requirements: {
    opportunityId: string;
    opportunityTitle: string;
    requirementId: string;
    requirementLabel: string;
    status: Requirement['status'];
  }[];
}[] {
  const byFact = new Map<
    string,
    {
      opportunityId: string;
      opportunityTitle: string;
      requirementId: string;
      requirementLabel: string;
      status: Requirement['status'];
    }[]
  >();

  for (const opportunity of opportunities) {
    for (const requirement of opportunity.requirements) {
      if (!requirement.profileFactKey) continue;
      // A settled requirement is not holding anything up.
      if (requirement.status !== 'unresolved') continue;

      const list = byFact.get(requirement.profileFactKey) ?? [];
      list.push({
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        requirementId: requirement.id,
        requirementLabel: requirement.label,
        status: requirement.status,
      });
      byFact.set(requirement.profileFactKey, list);
    }
  }

  return [...byFact.entries()].map(([factKey, requirements]) => ({ factKey, requirements }));
}
