import { z } from 'zod';

/**
 * Shared primitives for the Oppulse AI API contract.
 *
 * Every schema in this folder is the contract of record: the HTTP client
 * validates every response against it, and Phase B mirrors the same shapes
 * in FastAPI/Pydantic (verified in CI against `z.toJSONSchema()`).
 */

export const uuidSchema = z.uuid();

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const urlSchema = z.url();

/** Confidence in a fact or an assessment. Never conflated with certainty. */
export const confidenceSchema = z.enum(['high', 'medium', 'low']);

/**
 * Where a claim came from. Every high-stakes claim links to one of these so
 * the UI can always open a source drawer.
 */
export const evidenceStanceSchema = z.enum(['supports', 'contradicts']);

export const sourceQualitySchema = z.enum([
  'official',
  'primary',
  'secondary',
  'aggregator',
  'unknown',
]);

export const paginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    request_id: z.string().optional(),
    details: z.unknown().optional(),
    field_errors: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

/** A page reference inside a source document, e.g. "p. 4". */
export const pageReferenceSchema = z.string().nullable();

export type Confidence = z.infer<typeof confidenceSchema>;
export type SourceQuality = z.infer<typeof sourceQualitySchema>;
export type EvidenceStance = z.infer<typeof evidenceStanceSchema>;
