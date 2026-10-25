import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

/**
 * Mission (goal) and agent-run schemas.
 *
 * A run never blocks on an HTTP request: the API creates it, the worker
 * executes it, and the client reads persisted progress events.
 */

export const opportunityTypeSchema = z.enum([
  'research_internship',
  'fellowship',
  'scholarship',
  'summer_school',
  'research_program',
  'grant',
  'course',
  'conference',
  'other',
]);

export const educationLevelSchema = z.enum(['bachelor', 'master', 'phd', 'any']);

export const fundingPreferenceSchema = z.enum(['fully_funded', 'partial_ok', 'any']);

export const missionCriteriaSchema = z.object({
  opportunityTypes: z.array(opportunityTypeSchema),
  academicInterests: z.array(z.string()),
  /** The broad regions the mission looks in. */
  destinations: z.array(z.string()),
  /**
   * The countries the student chose, as ISO-3166 codes.
   *
   * The codes are the criterion — not a rendered flag, and not a country
   * name. The order is the student's own priority order, when they gave
   * one.
   */
  destinationCountries: z.array(z.string()),
  educationLevel: educationLevelSchema,
  fundingPreference: fundingPreferenceSchema,
  /** Free-text start period, e.g. "Summer 2027". */
  startPeriod: z.string(),
  /** Whether the confirmed profile may be used to personalise results. */
  useProfile: z.boolean(),
  /** Domains or source names the agent is allowed to read. */
  sourceScope: z.array(z.string()),
});

export const monitoringConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['hourly', 'daily', 'weekly']),
});

export const missionStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);

/**
 * Where the mission came from.
 *
 * It matters because the source decides what the student has already
 * agreed to, and the interface has to say so when a mission was started by
 * the assistant rather than by the student.
 */
export const missionSourceSchema = z.enum(['onboarding', 'assistant', 'opportunity', 'manual']);

export const missionSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  /** The student's own words. */
  objective: z.string(),
  criteria: missionCriteriaSchema,
  status: missionStatusSchema,
  /** Where the mission came from. */
  source: missionSourceSchema,
  /** The documents this mission is allowed to use. */
  selectedDocumentIds: z.array(uuidSchema),
  /** The confirmed profile facts this mission used. */
  confirmedFactIds: z.array(uuidSchema),
  /** The plain-language limits the student was shown before the run. */
  limitations: z.array(z.string()),
  /** When the student confirmed the mission. Null until they do. */
  userConfirmedAt: isoDateTimeSchema.nullable(),
  monitoring: monitoringConfigSchema,
  latestRunId: uuidSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const missionListSchema = z.object({
  missions: z.array(missionSchema),
});

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export const runStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_for_input',
  'paused',
  'completed',
  'partial',
  'failed',
  'cancelled',
]);

/** Coarse phase label shown in the run timeline. */
export const runPhaseSchema = z.enum([
  'queued',
  'understanding',
  'searching',
  'fetching',
  'extracting',
  'evaluating',
  'saving',
  'done',
]);

export const runSummarySchema = z.object({
  sourcesReviewed: z.number().int().nonnegative(),
  candidatesFound: z.number().int().nonnegative(),
  needingVerification: z.number().int().nonnegative(),
  /** Sources that could not be reached. Never folded into "none found". */
  unreachable: z.number().int().nonnegative(),
});

export const runErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  /** True when re-running the same mission could succeed. */
  retryable: z.boolean(),
});

export const runBudgetSchema = z.object({
  modelCalls: z.number().int().nonnegative(),
  searchCalls: z.number().int().nonnegative(),
  fetchedSources: z.number().int().nonnegative(),
  elapsedSeconds: z.number().int().nonnegative(),
});

export const agentRunSchema = z.object({
  id: uuidSchema,
  missionId: uuidSchema,
  status: runStatusSchema,
  phase: runPhaseSchema,
  summary: runSummarySchema.nullable(),
  error: runErrorSchema.nullable(),
  budgetUsed: runBudgetSchema,
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
});

export const runEventTypeSchema = z.enum([
  'run.queued',
  'run.started',
  'run.paused',
  'run.resumed',
  'run.retried',
  'understanding.started',
  'understanding.completed',
  'search.started',
  'search.completed',
  'source.retrieved',
  'source.unavailable',
  'requirements.extracted',
  'eligibility.evaluated',
  'deadline.extracted',
  'funding.assessed',
  'opportunity.saved',
  'profile.needs_confirmation',
  'provider.warning',
  'run.completed',
  'run.partial',
  'run.failed',
  'run.cancelled',
]);

export const runEventSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  type: runEventTypeSchema,
  /** A factual statement about what happened. Never internal reasoning. */
  message: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoDateTimeSchema,
});

export const runEventListSchema = z.object({
  events: z.array(runEventSchema),
  nextCursor: z.string().nullable(),
});

/** `202 Accepted` body returned when a run is queued. */
export const runStartResponseSchema = z.object({
  runId: uuidSchema,
  status: z.string(),
});

export const createMissionRequestSchema = z.object({
  title: z.string().min(1).max(140),
  objective: z.string().min(1).max(4000),
  criteria: missionCriteriaSchema.partial().optional(),
});

export const updateMissionRequestSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  objective: z.string().min(1).max(4000).optional(),
  criteria: missionCriteriaSchema.partial().optional(),
  status: missionStatusSchema.optional(),
  monitoring: monitoringConfigSchema.partial().optional(),
});

export type OpportunityType = z.infer<typeof opportunityTypeSchema>;
export type EducationLevel = z.infer<typeof educationLevelSchema>;
export type FundingPreference = z.infer<typeof fundingPreferenceSchema>;
export type MissionCriteria = z.infer<typeof missionCriteriaSchema>;
export type Mission = z.infer<typeof missionSchema>;
export type MissionStatus = z.infer<typeof missionStatusSchema>;
export type MissionSource = z.infer<typeof missionSourceSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunPhase = z.infer<typeof runPhaseSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type RunEvent = z.infer<typeof runEventSchema>;
export type RunEventType = z.infer<typeof runEventTypeSchema>;
export type CreateMissionRequest = z.infer<typeof createMissionRequestSchema>;
export type UpdateMissionRequest = z.infer<typeof updateMissionRequestSchema>;
