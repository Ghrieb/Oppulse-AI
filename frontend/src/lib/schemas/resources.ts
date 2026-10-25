import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';

/**
 * Country identity.
 *
 * The API stores an ISO-3166 alpha-2 code, never a rendered flag. Flags are
 * a presentation detail and must not be baked into stored data, so a
 * different region, a corrected name or a missing asset can be handled
 * without a data migration.
 */

/** A country, or a multi-country region that has no single flag. */
export const countryKindSchema = z.enum(['country', 'region']);

export const countryIdentitySchema = z.object({
  /** ISO-3166 alpha-2, or a stable pseudo-code for regions. */
  iso2: z.string(),
  name: z.string(),
  kind: countryKindSchema,
  /** Broad grouping used for filtering, e.g. "Europe". */
  region: z.string().nullable(),
});
export type CountryIdentity = z.infer<typeof countryIdentitySchema>;

/**
 * Institution brand.
 *
 * The browser never fetches an arbitrary third-party logo. A backend that
 * has validated the host, resized the asset and cached it in its own storage
 * supplies `logoUrl`; until then the interface renders a deterministic
 * monogram.
 */
export const brandSourceSchema = z.enum(['official', 'provider', 'fallback']);

/**
 * Whether a caching icon service may be consulted for this institution.
 *
 * `cache` is only granted to a brand the backend has verified as a real
 * institution. Synthetic brands use `none`, so the prototype never makes a
 * third-party request.
 */
export const brandIconSourceSchema = z.enum(['cache', 'none']);

export const institutionBrandSchema = z.object({
  institutionName: z.string(),
  officialDomain: z.string(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  /** Required whenever an image is supplied. */
  attribution: z.string().nullable(),
  /** When the brand was retrieved, for the "verified" indicator. */
  verifiedAt: isoDateTimeSchema.nullable(),
  source: brandSourceSchema,
  /**
   * True when no real asset is available and the interface renders the
   * generated mark. The generated mark is the product's default, not an
   * apology for a missing image.
   */
  generated: z.boolean(),
  /** Whether a caching icon service may be used for this institution. */
  iconSource: brandIconSourceSchema,
});
export type InstitutionBrand = z.infer<typeof institutionBrandSchema>;

/**
 * A single deadline. A programme may have several stages, so the model
 * holds a list rather than one date.
 */
export const deadlineStageSchema = z.enum(['applications_open', 'final_submission', 'other']);

export const programmeDeadlineSchema = z.object({
  id: uuidSchema,
  stage: deadlineStageSchema,
  value: z.string().nullable(),
  timezone: z.string().nullable(),
  status: z.enum(['verified', 'unresolved', 'conflict', 'not_found']),
  remainingDays: z.number().int().nullable(),
  evidenceId: uuidSchema.nullable(),
  label: z.string(),
});
export type ProgrammeDeadline = z.infer<typeof programmeDeadlineSchema>;
