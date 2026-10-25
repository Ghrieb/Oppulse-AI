import { z } from 'zod';
import {
  confidenceSchema,
  isoDateTimeSchema,
  pageReferenceSchema,
  sourceQualitySchema,
  urlSchema,
  uuidSchema,
} from './common';
import {
  countryIdentitySchema,
  institutionBrandSchema,
  programmeDeadlineSchema,
} from './resources';

/**
 * Opportunity, source, evidence and match schemas.
 *
 * The five concepts the product deliberately keeps separate (spec §6.5):
 * fit, eligibility, funding, competitiveness, confidence.
 */

export const deadlineStatusSchema = z.enum(['verified', 'unresolved', 'conflict', 'not_found']);

export const deadlineConflictSchema = z.object({
  value: z.string(),
  url: urlSchema,
  retrievedAt: isoDateTimeSchema,
  sourceId: uuidSchema,
});

export const deadlineSchema = z.object({
  /** ISO-8601 date or date-time as stated by the source. */
  value: z.string().nullable(),
  timezone: z.string().nullable(),
  status: deadlineStatusSchema,
  /** Days remaining, calculated by the backend from verified data only. */
  remainingDays: z.number().int().nullable(),
  evidenceId: uuidSchema.nullable(),
  /** Present when two official sources disagree. */
  conflicts: z.array(deadlineConflictSchema),
  note: z.string().nullable(),
});

export const fundingComponentStatusSchema = z.enum([
  'confirmed',
  'partial',
  'not_covered',
  'unknown',
]);

export const fundingComponentSchema = z.object({
  label: z.string(),
  status: fundingComponentStatusSchema,
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  evidenceId: uuidSchema.nullable(),
  note: z.string().nullable(),
});

export const fundingSchema = z.object({
  coverage: z.enum(['fully_funded', 'partial', 'tuition_only', 'unfunded', 'unknown']),
  components: z.array(fundingComponentSchema),
  /** Uncovered amount when the source supports a calculation. */
  estimatedGap: z
    .object({
      amount: z.number().nonnegative(),
      currency: z.string(),
      basis: z.string(),
    })
    .nullable(),
  note: z.string().nullable(),
});

export const requirementKindSchema = z.enum([
  'nationality',
  'degree',
  'field',
  'language',
  'document',
  'age',
  'availability',
  'other',
]);

export const requirementStatusSchema = z.enum([
  'likely',
  'unresolved',
  'ineligible',
  'not_applicable',
]);

/**
 * A deterministic eligibility check.
 *
 * The agent proposes the requirement; the check decides it. Keeping the
 * comparison explicit means an eligibility answer is always explainable and
 * never a guess.
 */
export const requirementCheckSchema = z.object({
  /** The profile fact the requirement is checked against. */
  factKey: z.string(),
  kind: z.enum(['at_least', 'in_list', 'present']),
  /** The threshold for `at_least`. */
  value: z.number().optional(),
  /** The accepted codes for `in_list`. */
  values: z.array(z.string()).optional(),
  /** A human-readable unit, e.g. "IELTS band". */
  unit: z.string().nullable().optional(),
});
export type RequirementCheck = z.infer<typeof requirementCheckSchema>;

/**
 * An age rule, as stated by an official source.
 *
 * The model may *extract* this rule; a typed service does the arithmetic.
 * The rule keeps the date the age is measured on, because an age limit is
 * usually stated against the start of the programme rather than today.
 */
export const ageRuleSchema = z.object({
  kind: z.enum(['min_age', 'max_age', 'age_range']),
  /** The youngest age allowed, when there is one. */
  minAge: z.number().nullable(),
  /** The oldest age allowed, when there is one. */
  maxAge: z.number().nullable(),
  /** The date the age is measured on — the eligibility date, not today. */
  eligibilityDate: z.string(),
  /** Where the rule came from, because age rules differ between calls. */
  sourceTitle: z.string(),
  sourceUrl: urlSchema,
  /** Whether the rule itself still needs checking. */
  verification: z.enum(['verified', 'needs_verification', 'conflicting']),
});
export type AgeRule = z.infer<typeof ageRuleSchema>;

export const requirementSchema = z.object({
  id: uuidSchema,
  label: z.string(),
  kind: requirementKindSchema,
  status: requirementStatusSchema,
  /** The clause as written in the source. */
  sourceClause: z.string().nullable(),
  evidenceIds: z.array(uuidSchema),
  /** Which confirmed profile fact was compared, when one was. */
  profileFactKey: z.string().nullable(),
  /** The rule that decides this requirement, when it is decided by a check. */
  check: requirementCheckSchema.nullable(),
  /**
   * The age rule, when this requirement is decided by age.
   *
   * The date of birth itself is a protected attribute and never travels
   * with the requirement; only the rule and its source do.
   */
  ageRule: ageRuleSchema.nullable(),
  /**
   * Whether this requirement must be satisfied. A non-blocking requirement
   * that is unresolved becomes a warning, not a downgrade of eligibility.
   */
  blocking: z.boolean(),
  explanation: z.string(),
});

export const opportunitySchema = z.object({
  id: uuidSchema,
  title: z.string(),
  institution: z.string(),
  type: z.enum([
    'research_internship',
    'fellowship',
    'scholarship',
    'summer_school',
    'research_program',
    'grant',
    'course',
    'conference',
    'other',
  ]),
  /** Country or region, with an ISO code so identity is never a string. */
  country: countryIdentitySchema,
  sourceDomain: z.string(),
  canonicalUrl: urlSchema,
  summary: z.string(),
  /** Logo and banner metadata, resolved and cached by the backend. */
  institutionBrand: institutionBrandSchema,
  /** Programme length, e.g. "12 months". */
  duration: z.string().nullable(),
  /** When applications open, when the source states it. */
  applicationOpensAt: z.string().nullable(),
  tags: z.array(z.string()),
  /** The final, most important deadline. */
  deadline: deadlineSchema,
  /** Further stage deadlines, e.g. an interview round. */
  additionalDeadlines: z.array(programmeDeadlineSchema),
  funding: fundingSchema,
  requirements: z.array(requirementSchema),
  saved: z.boolean(),
  dismissed: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const sourceStatusSchema = z.enum(['retrieved', 'unavailable']);

export const sourceSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  url: urlSchema,
  title: z.string(),
  domain: z.string(),
  excerpt: z.string(),
  quality: sourceQualitySchema,
  status: sourceStatusSchema,
  contentHash: z.string(),
  retrievedAt: isoDateTimeSchema,
  pageReference: pageReferenceSchema,
  /** Why retrieval failed, when it did. */
  failureReason: z.string().nullable(),
});

export const evidenceSchema = z.object({
  id: uuidSchema,
  sourceId: uuidSchema,
  opportunityId: uuidSchema,
  claim: z.string(),
  excerpt: z.string(),
  pageReference: pageReferenceSchema,
  url: urlSchema,
  retrievedAt: isoDateTimeSchema,
  quality: sourceQualitySchema,
  stance: z.enum(['supports', 'contradicts']),
  confidence: confidenceSchema,
});

export const matchSchema = z.object({
  id: uuidSchema,
  missionId: uuidSchema.nullable(),
  opportunityId: uuidSchema,
  /** Profile match out of 100. Never an admission probability. */
  fitScore: z.number().int().min(0).max(100),
  fitLabel: z.string(),
  eligibility: z.enum(['likely', 'unresolved', 'ineligible']),
  competitiveness: z.enum(['high', 'moderate', 'low', 'unknown']),
  confidence: confidenceSchema,
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendation: z.string(),
  profileSnapshotId: uuidSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const opportunityListSchema = z.object({
  opportunities: z.array(opportunitySchema),
  /** Per-user assessments for the listed opportunities. */
  matches: z.array(matchSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const opportunityDetailSchema = z.object({
  opportunity: opportunitySchema,
  match: matchSchema.nullable(),
  evidence: z.array(evidenceSchema),
  sources: z.array(sourceSchema),
  /** Application workspace created from this opportunity, if any. */
  applicationId: uuidSchema.nullable(),
});

export const dismissOpportunityRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

/**
 * Comparing opportunities.
 *
 * The comparison is a *read* of what the agent already found: the same
 * eligibility, funding and deadline, side by side, with the differences
 * named. It never invents a ranking the evidence does not support.
 */
export const compareRequestSchema = z.object({
  opportunityIds: z.array(uuidSchema).min(2).max(4),
});

export const compareRowSchema = z.object({
  opportunityId: uuidSchema,
  title: z.string(),
  institution: z.string(),
  country: z.string(),
  fitScore: z.number().int().min(0).max(100),
  eligibility: z.enum(['likely', 'unresolved', 'ineligible']),
  deadline: z.string().nullable(),
  deadlineVerified: z.boolean(),
  fundingCoverage: z.enum(['fully_funded', 'partial', 'tuition_only', 'unfunded', 'unknown']),
  estimatedGap: z.number().nullable(),
  currency: z.string().nullable(),
  unresolvedRequirements: z.array(z.string()),
});

export const compareResponseSchema = z.object({
  rows: z.array(compareRowSchema),
  /** The differences worth the student's attention, in plain language. */
  differences: z.array(z.string()),
  /** What the comparison cannot settle. */
  unverified: z.array(z.string()),
});

export type Deadline = z.infer<typeof deadlineSchema>;
export type DeadlineStatus = z.infer<typeof deadlineStatusSchema>;
export type Funding = z.infer<typeof fundingSchema>;
export type FundingComponent = z.infer<typeof fundingComponentSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type RequirementStatus = z.infer<typeof requirementStatusSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Match = z.infer<typeof matchSchema>;
export type OpportunityDetail = z.infer<typeof opportunityDetailSchema>;
export type CompareRow = z.infer<typeof compareRowSchema>;
export type CompareResponse = z.infer<typeof compareResponseSchema>;
