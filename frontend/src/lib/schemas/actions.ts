import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

/**
 * Next best action.
 *
 * The workspace shows one prioritised action at a time, tied to a real
 * blocker, with the reason it matters and a link to the place where it can
 * be resolved.
 */
export const nextActionKindSchema = z.enum([
  'confirm_fact',
  'resolve_conflict',
  'complete_document',
  'review_proposal',
  'start_run',
  'check_source',
  'finish_draft',
  'prepare_checklist',
]);
export type NextActionKind = z.infer<typeof nextActionKindSchema>;

export const nextActionSchema = z.object({
  id: uuidSchema,
  kind: nextActionKindSchema,
  title: z.string(),
  /** Why this matters, in one sentence. */
  rationale: z.string(),
  /** Label for the button. */
  cta: z.string(),
  /** Where the action happens. */
  route: z.string(),
  /** Higher is more urgent. */
  priority: z.number().int(),
  /** The specific thing that is blocked, e.g. a fact id or a source id. */
  blockerId: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type NextAction = z.infer<typeof nextActionSchema>;

export const nextActionResponseSchema = z.object({
  action: nextActionSchema.nullable(),
});

/**
 * Capability status.
 *
 * The prototype disclosure evolves from one generic banner into a per-service
 * status, so a reviewer can see exactly which parts are live, which are
 * simulated, and which are unavailable.
 */
export const capabilityModeSchema = z.enum(['live', 'mocked', 'unavailable']);

export const capabilitySchema = z.object({
  key: z.enum(['data', 'ai', 'search', 'extraction', 'monitoring', 'in_app', 'email']),
  label: z.string(),
  mode: capabilityModeSchema,
  /** One line explaining what the user can actually do right now. */
  detail: z.string(),
});
export type Capability = z.infer<typeof capabilitySchema>;

export const capabilityStatusSchema = z.object({
  capabilities: z.array(capabilitySchema),
  /** True when the whole product is running against fixtures. */
  isPrototype: z.boolean(),
});
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;
