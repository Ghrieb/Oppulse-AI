import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';
import { missionCriteriaSchema } from './missions';
import { documentStatusSchema } from './profile';

/**
 * Onboarding contract.
 *
 * The onboarding is the product's first impression: it learns who the user
 * is, what they need and what they are blocked on, then produces an
 * editable mission. The answers are a durable asset — they become the
 * mission criteria and the fact provenance — so they are modelled
 * explicitly rather than kept as loose UI state.
 */

/** How the user chose to begin. Sets the first question, not a separate flow. */
export const intentChoiceSchema = z.enum(['goal', 'materials', 'link']);
export type IntentChoice = z.infer<typeof intentChoiceSchema>;

/** Stable identifiers so answers can be cited later. */
export const questionIdSchema = z.enum([
  'goal',
  'opportunity_type',
  'field',
  'destinations',
  'funding',
  'start_period',
  'use_documents',
  'age',
]);
export type QuestionId = z.infer<typeof questionIdSchema>;

/** How an answer was obtained. Profile-sourced answers are shown as such. */
export const answerSourceSchema = z.enum(['user', 'profile_fact', 'consent', 'default']);
export type AnswerSource = z.infer<typeof answerSourceSchema>;

export const answerValueSchema = z.union([z.string(), z.array(z.string()), z.boolean()]);
export type AnswerValue = z.infer<typeof answerValueSchema>;

export const onboardingAnswerSchema = z.object({
  questionId: questionIdSchema,
  value: answerValueSchema,
  answeredAt: isoDateTimeSchema,
  source: answerSourceSchema,
  /** The profile fact key this answer came from, when it came from one. */
  factKey: z.string().nullable(),
  /** Plain-language note shown when the answer was inferred, not typed. */
  note: z.string().nullable(),
});
export type OnboardingAnswer = z.infer<typeof onboardingAnswerSchema>;

export const onboardingDraftSchema = z.object({
  id: uuidSchema,
  intent: intentChoiceSchema.nullable(),
  /** A specific opportunity the user wants analysed, when they started from a link. */
  referenceUrl: z.string().nullable(),
  answers: z.array(onboardingAnswerSchema),
  /**
   * The document the user started from, and how far its reading has got.
   *
   * It lives in the draft rather than in browser state, so a refresh, another
   * device and a later AI run all see the same document rather than a
   * boolean that only this tab remembers.
   */
  uploadedDocumentId: uuidSchema.nullable(),
  uploadedDocumentStatus: documentStatusSchema.nullable(),
  /** Whether the student allowed the document to be used in AI context. */
  uploadedDocumentConsent: z.boolean().nullable(),
  /** The question to ask next, or null when the flow is complete. */
  currentQuestionId: questionIdSchema.nullable(),
  completed: z.boolean(),
  updatedAt: isoDateTimeSchema,
});
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

export const onboardingDraftResponseSchema = z.object({
  draft: onboardingDraftSchema,
});

/**
 * The plain-language mission the user sees and edits before any run starts.
 */
export const missionPreviewSchema = z.object({
  title: z.string(),
  objective: z.string(),
  criteria: missionCriteriaSchema,
  /** The plain-language sentence describing what the agent will do. */
  summary: z.string(),
  /** The profile facts that will be used, with their display labels. */
  usedFacts: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
    }),
  ),
  /** Document ids that will be used. */
  usedDocumentIds: z.array(uuidSchema),
  /** Where the agent will look. */
  sourceScope: z.array(z.string()),
  /** Honest statements about what this mission cannot do. */
  limitations: z.array(z.string()),
});
export type MissionPreview = z.infer<typeof missionPreviewSchema>;

/** What completing onboarding produces. */
export const onboardingCompleteSchema = z.object({
  mission: z.object({
    id: uuidSchema,
    title: z.string(),
    objective: z.string(),
  }),
  runId: uuidSchema.nullable(),
});
export type OnboardingComplete = z.infer<typeof onboardingCompleteSchema>;

export const createMissionFromDraftRequestSchema = z.object({
  draft: onboardingDraftSchema,
  /** Edits the user made to the derived criteria. */
  criteria: missionCriteriaSchema.partial().optional(),
});
