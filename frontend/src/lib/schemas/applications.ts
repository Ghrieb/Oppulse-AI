import { z } from 'zod';
import { isoDateTimeSchema, urlSchema, uuidSchema } from './common';

/**
 * Application workspace and writing-studio schemas.
 *
 * The writing studio never overwrites user content: the AI returns a
 * proposal, the student reviews a diff, and acceptance creates a new
 * version (spec §6.7, ADR-006).
 */

export const applicationStatusSchema = z.enum([
  'considering',
  'preparing',
  'waiting_for_documents',
  'waiting_for_recommender',
  'ready_for_review',
  'submitted',
  'accepted',
  'rejected',
  'withdrawn',
]);

export const checklistItemStatusSchema = z.enum(['missing', 'ready', 'needs_attention', 'done']);

export const checklistItemSchema = z.object({
  id: uuidSchema,
  label: z.string(),
  status: checklistItemStatusSchema,
  /** Where this requirement came from, e.g. "Call PDF, p. 3". */
  source: z.string().nullable(),
  dueDate: z.string().nullable(),
  documentId: uuidSchema.nullable(),
  note: z.string().nullable(),
});

export const taskStatusSchema = z.enum(['todo', 'doing', 'done']);

export const taskSchema = z.object({
  id: uuidSchema,
  label: z.string(),
  status: taskStatusSchema,
  dueDate: z.string().nullable(),
  blockedReason: z.string().nullable(),
});

export const applicationSchema = z.object({
  id: uuidSchema,
  opportunityId: uuidSchema,
  opportunityTitle: z.string(),
  institution: z.string(),
  status: applicationStatusSchema,
  /** Null when the deadline is not verified. */
  deadline: z.string().nullable(),
  deadlineVerified: z.boolean(),
  checklist: z.array(checklistItemSchema),
  tasks: z.array(taskSchema),
  draftIds: z.array(uuidSchema),
  /** Completed checklist items over total checklist items. */
  completion: z.object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  nextBestAction: z.string().nullable(),
  officialUrl: urlSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const applicationListSchema = z.object({
  applications: z.array(applicationSchema),
});

/**
 * The kinds of document the agent can help with.
 *
 * `recommender_briefing` is material the student hands to their referee. It
 * is never written or signed by the agent — it is briefing material, so
 * the interface says so wherever it appears.
 */
export const draftTypeSchema = z.enum([
  'motivation_letter',
  'research_statement',
  'cv_revision',
  'email',
  'supervisor_email',
  'recommender_request',
  'recommender_briefing',
]);
export type DraftType = z.infer<typeof draftTypeSchema>;

/** What each document is for, and what the agent is allowed to do with it. */
export const DRAFT_TYPE_META: Record<
  DraftType,
  { label: string; description: string; effect: 'prepares' | 'would_send' }
> = {
  motivation_letter: {
    label: 'Motivation letter',
    description:
      'You write it. Oppulse drafts a starting point from your confirmed facts and shows you every change.',
    effect: 'prepares',
  },
  research_statement: {
    label: 'Research statement',
    description: 'A description of your work and where you want to take it.',
    effect: 'prepares',
  },
  cv_revision: {
    label: 'CV revision',
    description: 'The same experience, written for this programme.',
    effect: 'prepares',
  },
  email: {
    label: 'General email',
    description: 'A short message to a programme or a person.',
    effect: 'prepares',
  },
  supervisor_email: {
    label: 'Email to a supervisor',
    description:
      'Asking a supervisor about a placement. Oppulse prepares it — it is never sent for you.',
    effect: 'prepares',
  },
  recommender_request: {
    label: 'Request to a referee',
    description: 'Asking someone to write you a reference.',
    effect: 'prepares',
  },
  recommender_briefing: {
    label: 'Briefing material for your referee',
    description:
      'Material you give your referee so they can write a strong letter. This is not a letter and is not written as one.',
    effect: 'prepares',
  },
};

export const draftVersionSchema = z.object({
  version: z.number().int().positive(),
  /** Tiptap document JSON. */
  content: z.string(),
  createdAt: isoDateTimeSchema,
  source: z.enum(['user', 'ai_accepted', 'import', 'created']),
  summary: z.string().nullable(),
});

export const proposalStatusSchema = z.enum(['pending', 'accepted', 'rejected']);

export const proposalSchema = z.object({
  id: uuidSchema,
  draftId: uuidSchema,
  baseVersion: z.number().int().positive(),
  content: z.string(),
  summary: z.string(),
  /** Claims the model could not ground in the confirmed profile. */
  unsupportedClaims: z.array(z.string()),
  status: proposalStatusSchema,
  createdAt: isoDateTimeSchema,
});

export const draftSchema = z.object({
  id: uuidSchema,
  applicationId: uuidSchema,
  opportunityId: uuidSchema,
  type: draftTypeSchema,
  title: z.string(),
  currentVersion: z.number().int().positive(),
  content: z.string(),
  versions: z.array(draftVersionSchema),
  pendingProposal: proposalSchema.nullable(),
  updatedAt: isoDateTimeSchema,
});

export const draftListSchema = z.object({
  drafts: z.array(draftSchema),
});

export const updateDraftRequestSchema = z.object({
  content: z.string(),
  /** Version the edit was based on, for optimistic-concurrency checks. */
  baseVersion: z.number().int().positive().optional(),
});

export const createProposalRequestSchema = z.object({
  /** Optional selection: rewrite only this part of the document. */
  selectedText: z.string().optional(),
  instruction: z.string().min(1).max(2000),
});

/** Starts a new document on an application. */
export const createDraftRequestSchema = z.object({
  type: draftTypeSchema,
});
export type CreateDraftRequest = z.infer<typeof createDraftRequestSchema>;

export const createApplicationRequestSchema = z.object({
  opportunityId: uuidSchema,
  notes: z.string().max(2000).optional(),
});

export const updateApplicationRequestSchema = z.object({
  status: applicationStatusSchema.optional(),
  notes: z.string().max(4000).optional(),
  tasks: z
    .array(
      z.object({
        id: uuidSchema,
        label: z.string(),
        status: taskStatusSchema,
        dueDate: z.string().nullable(),
      }),
    )
    .optional(),
});

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type DraftVersion = z.infer<typeof draftVersionSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type UpdateDraftRequest = z.infer<typeof updateDraftRequestSchema>;
export type CreateProposalRequest = z.infer<typeof createProposalRequestSchema>;
