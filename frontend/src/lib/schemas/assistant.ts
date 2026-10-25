import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';
import { draftTypeSchema } from './applications';

/**
 * Context-aware assistant contracts.
 *
 * The backend decides which context is permitted; the client can only ask
 * for a bounded set of identifiers, never arbitrary storage paths or
 * provider instructions.
 *
 * The assistant answers with a list of *blocks* rather than a paragraph, so
 * it can show evidence, hand back a checklist, offer a draft, or start a
 * run — each with the context it actually used.
 */

export const assistantContextSchema = z.object({
  missionId: uuidSchema.optional(),
  opportunityId: uuidSchema.optional(),
  applicationId: uuidSchema.optional(),
  draftId: uuidSchema.optional(),
  /** Document ids the user has explicitly authorised for this message. */
  documentIds: z.array(uuidSchema).optional(),
});
export type AssistantContext = z.infer<typeof assistantContextSchema>;

/* ------------------------------------------------------------------ */
/* Response blocks                                                      */
/* ------------------------------------------------------------------ */

export const assistantTextBlockSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
});

export const assistantEvidenceBlockSchema = z.object({
  kind: z.literal('evidence'),
  title: z.string(),
  summary: z.string(),
  sources: z.array(
    z.object({
      title: z.string(),
      url: z.url(),
      quote: z.string(),
      quality: z.enum(['official', 'primary', 'secondary', 'aggregator', 'unknown']),
    }),
  ),
  /** The requirement this evidence answers, when it answers one. */
  requirementId: uuidSchema.nullable(),
});

export const assistantChecklistBlockSchema = z.object({
  kind: z.literal('checklist'),
  title: z.string(),
  items: z.array(
    z.object({
      label: z.string(),
      status: z.enum(['missing', 'ready', 'needs_attention', 'done']),
      detail: z.string().nullable(),
      /** Where the item can be resolved. */
      route: z.string().nullable(),
    }),
  ),
});

export const assistantDraftActionBlockSchema = z.object({
  kind: z.literal('draft_action'),
  title: z.string(),
  description: z.string(),
  draftType: draftTypeSchema,
  applicationId: uuidSchema.nullable(),
  /** Whether this prepares a document, or would send one. */
  effect: z.enum(['prepares', 'would_send']),
});

export const assistantRunBlockSchema = z.object({
  kind: z.literal('run'),
  runId: uuidSchema,
  status: z.string(),
  message: z.string(),
});

/**
 * The media context.
 *
 * Media is *secondary* evidence. It never proves eligibility, funding, a
 * deadline or an admission likelihood, and it is labelled so the student
 * cannot mistake a promotional image for a fact.
 */
export const mediaContextSchema = z.object({
  kind: z.enum(['image', 'video']),
  url: z.string(),
  title: z.string(),
  publisher: z.string(),
  publishedAt: z.string().nullable().optional(),
  sourceType: z.enum(['official', 'verified_provider', 'secondary']),
  attribution: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  status: z.enum(['available', 'unavailable', 'removed', 'not_reviewed']),
});
export type MediaContext = z.infer<typeof mediaContextSchema>;

/**
 * The answer to a question about an institution.
 *
 * It is concise first and expandable second, and it separates what the
 * official source states from what Oppulse could not verify.
 */
export const assistantInstitutionBlockSchema = z.object({
  kind: z.literal('institution'),
  /** A plain-language description. */
  description: z.string(),
  /** Where the institution is. */
  location: z.string(),
  country: z.string(),
  /** The institution's type, but only where it is verified. */
  institutionType: z.string().nullable(),
  /** The programme or research context that is relevant here. */
  programmeContext: z.string().nullable(),
  /** The evidence this description rests on. */
  evidence: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      quote: z.string(),
      sourceType: z.enum(['official', 'verified_provider', 'secondary']),
    }),
  ),
  /** The media, clearly labelled as secondary. */
  media: z.array(mediaContextSchema),
  /**
   * What Oppulse could not verify.
   *
   * It is not an apology: it is the honest edge of the answer, and it is
   * what stops an unverified claim from reading like a fact.
   */
  unverified: z.array(z.string()),
  /** The one action that follows from this answer. */
  action: z.string().nullable(),
});
export type AssistantInstitutionBlock = z.infer<typeof assistantInstitutionBlockSchema>;

/**
 * Media, as secondary context.
 *
 * It never proves anything: not eligibility, not funding, not a deadline.
 * The label says so, and the block carries the publisher and the date so
 * the student can judge it.
 */
export const assistantMediaContextBlockSchema = z.object({
  kind: z.literal('media_context'),
  /** What the media is about, in one line. */
  subject: z.string(),
  media: z.array(mediaContextSchema),
});
export type AssistantMediaContextBlock = z.infer<typeof assistantMediaContextBlockSchema>;

/**
 * A reference to an opportunity.
 *
 * It is how the chat opens the detail panel without repeating the
 * opportunity's whole content in the message.
 */
export const assistantOpportunityReferenceBlockSchema = z.object({
  kind: z.literal('opportunity_reference'),
  opportunityId: uuidSchema,
  title: z.string(),
  institution: z.string(),
  country: z.string(),
  /** Why this opportunity is being mentioned. */
  reason: z.string(),
});
export type AssistantOpportunityReferenceBlock = z.infer<
  typeof assistantOpportunityReferenceBlockSchema
>;

/**
 * What could not be verified.
 *
 * This is the honest edge of an answer: what was checked, what remains
 * unknown, and the most useful next step. It is not an apology, and it is
 * never replaced with a confident guess.
 */
export const assistantUnknownBlockSchema = z.object({
  kind: z.literal('unknown_or_conflict'),
  /** What could not be established. */
  question: z.string(),
  /** What was checked, so the effort is visible. */
  checked: z.array(z.string()),
  /** The most useful next action, when there is one. */
  nextAction: z.string().nullable(),
  /** True when two sources disagree, rather than when nothing was found. */
  conflict: z.boolean(),
});
export type AssistantUnknownBlock = z.infer<typeof assistantUnknownBlockSchema>;

/**
 * The actions the assistant may offer.
 *
 * They are named, so the interface can offer the right control and the
 * backend can refuse the ones it has no business performing.
 */
export const assistantActionKindSchema = z.enum([
  'create_draft',
  'create_checklist',
  'start_run',
  'open_route',
  'open_opportunity',
  'compare',
  'save',
  'check_eligibility',
  'draft_inquiry',
]);
export type AssistantActionKind = z.infer<typeof assistantActionKindSchema>;

export const assistantActionBlockSchema = z.object({
  kind: z.literal('action'),
  label: z.string(),
  description: z.string().nullable(),
  action: assistantActionKindSchema,
  payload: z.record(z.string(), z.unknown()),
  effect: z.enum(['prepares', 'would_send']),
});

export const assistantBlockSchema = z.discriminatedUnion('kind', [
  assistantTextBlockSchema,
  assistantEvidenceBlockSchema,
  assistantChecklistBlockSchema,
  assistantDraftActionBlockSchema,
  assistantRunBlockSchema,
  assistantInstitutionBlockSchema,
  assistantMediaContextBlockSchema,
  assistantOpportunityReferenceBlockSchema,
  assistantUnknownBlockSchema,
  assistantActionBlockSchema,
]);
export type AssistantBlock = z.infer<typeof assistantBlockSchema>;

/* ------------------------------------------------------------------ */
/* Conversation                                                         */
/* ------------------------------------------------------------------ */

export const assistantMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  /** The text of the turn. Assistant turns render their blocks as well. */
  content: z.string(),
  createdAt: isoDateTimeSchema,
  blocks: z.array(assistantBlockSchema).optional(),
  /** The context the assistant used for this turn. */
  context: assistantContextSchema.optional(),
});
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export const assistantHistorySchema = z.object({
  messages: z.array(assistantMessageSchema),
});

export const assistantRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  context: assistantContextSchema.optional(),
  /** The text the user has selected, when asking about a selection. */
  selectedText: z.string().optional(),
});

export const assistantResponseSchema = z.object({
  blocks: z.array(assistantBlockSchema),
  suggestions: z.array(z.string()),
  /** The context the assistant actually used, echoed back for the strip. */
  context: assistantContextSchema,
});

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** An action the assistant offers, which the user must confirm. */
export const assistantActionRequestSchema = z.object({
  action: assistantActionKindSchema,
  context: assistantContextSchema.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const assistantActionResponseSchema = z.object({
  /** The block describing what happened, ready to append to the thread. */
  block: assistantBlockSchema,
  /** Where the user should go next, when there is somewhere to go. */
  route: z.string().nullable(),
  /** The id of the thing that was created, when something was. */
  createdId: z.string().nullable(),
});

export type AssistantActionRequest = z.infer<typeof assistantActionRequestSchema>;
export type AssistantActionResponse = z.infer<typeof assistantActionResponseSchema>;
