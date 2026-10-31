import { z } from 'zod';
import { confidenceSchema, isoDateTimeSchema, pageReferenceSchema, uuidSchema } from './common';
import { alertCategorySchema, emailCadenceSchema } from './monitoring';

/**
 * Profile and document schemas.
 *
 * A fact only becomes eligible for important decisions after the student
 * confirms it (spec §5.1). Extracted facts are `proposed` until then.
 */

export const factStatusSchema = z.enum(['confirmed', 'proposed', 'rejected', 'excluded']);
export type FactStatus = z.infer<typeof factStatusSchema>;

/**
 * The sections of the profile passport.
 *
 * The taxonomy belongs to the contract, not the interface: the backend
 * assigns a section when it extracts a fact, so the passport never has to
 * guess where a value came from.
 */
export const profileSectionSchema = z.enum([
  'about',
  'education',
  'experience',
  'skills',
  'languages',
  'preferences',
]);
export type ProfileSection = z.infer<typeof profileSectionSchema>;

export const factSourceSchema = z.object({
  documentId: uuidSchema,
  documentName: z.string(),
  excerpt: z.string(),
  pageReference: pageReferenceSchema,
  /** The section heading the value was found under, when there was one. */
  section: z.string().nullable(),
});

export const profileFactSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  label: z.string(),
  value: z.string(),
  status: factStatusSchema,
  confidence: confidenceSchema,
  /** Populated when the fact was extracted from an uploaded document. */
  source: factSourceSchema.nullable(),
  /** Set when the student corrected the extracted value. */
  corrected: z.boolean(),
  /** The student withdrew this fact from the AI's context. */
  excluded: z.boolean(),
  /** Plain-language explanation of what this fact is used to decide. */
  usedFor: z.string().nullable(),
  /** Set when another source states a different value. */
  conflicting: z.boolean(),
  /**
   * The conflicting value, and where it came from. A conflict is never
   * resolved silently: the student chooses.
   */
  conflict: z
    .object({
      value: z.string(),
      documentName: z.string(),
      pageReference: pageReferenceSchema,
      excerpt: z.string(),
    })
    .nullable(),
  /** When the fact last changed. */
  updatedAt: isoDateTimeSchema.nullable(),
  /** The section of the passport this fact belongs to. */
  section: profileSectionSchema,
  /**
   * A machine-comparable value, so an eligibility rule never has to parse
   * the human-readable one. `6.5` for IELTS, `2` for a master's year.
   */
  numericValue: z.number().nullable(),
  /** A normalised code, such as a country code. */
  code: z.string().nullable(),
});
export type ProfileFact = z.infer<typeof profileFactSchema>;

/**
 * How often, and whether, a category of alert is emailed.
 *
 * This is a *preference* — which emails the student wants, and how often.
 * It is not consent: consent to email at all lives in `profileConsentSchema`.
 */
export const emailPreferenceSchema = z.object({
  /** The cadence used for a category the student has not overridden. */
  defaultCadence: emailCadenceSchema,
  /** One cadence per alert category. */
  categories: z.record(alertCategorySchema, emailCadenceSchema),
});
export type EmailPreference = z.infer<typeof emailPreferenceSchema>;

export const profilePreferencesSchema = z.object({
  /** Guided view = more explanation; Focus view = denser results. */
  guidedView: z.boolean(),
  /** Which emails the student wants, and how often. */
  email: emailPreferenceSchema,
  timezone: z.string(),
  currency: z.string(),
  /** Notes extracted from the student's CV by the AI. */
  cvNotes: z.array(z.string()).optional().default([]),
});

/**
 * Consent.
 *
 * Consent is permission, not preference. It is revocable, and revoking it
 * stops future use without rewriting anything the student has already seen
 * or approved.
 */
export const profileConsentSchema = z.object({
  /** Explicit consent to send extracted context to an external model provider. */
  externalModelProcessing: z.boolean(),
  allowProfileMatching: z.boolean(),
  /** "May Oppulse send email notifications at all?" */
  emailNotifications: z.boolean(),
  /** `null` means "keep until I delete it". */
  retentionDays: z.number().int().positive().nullable(),
});

export const profileSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  headline: z.string().nullable(),
  facts: z.array(profileFactSchema),
  preferences: profilePreferencesSchema,
  consent: profileConsentSchema,
  updatedAt: isoDateTimeSchema,
});

export const documentCategorySchema = z.enum([
  'cv',
  'transcript',
  'certificate',
  'language',
  'announcement',
  'other',
]);

export const documentStatusSchema = z.enum([
  'awaiting_upload',
  'uploaded',
  'processing',
  'needs_review',
  'processed',
  'partial',
  'failed',
  'deleted',
]);

/** How far the extraction got, and what it could not read. */
export const documentExtractionSchema = z.object({
  /** Facts the model proposed from this document. */
  proposedFactIds: z.array(uuidSchema),
  /** Sections that could not be read, described plainly. */
  unreadSections: z.array(z.string()),
  /** How the text was obtained, for the disclosure copy. */
  method: z.enum(['text_layer', 'ocr', 'none']),
  completedAt: isoDateTimeSchema.nullable(),
});
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;

export const documentSchema = z.object({
  id: uuidSchema,
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  category: documentCategorySchema,
  status: documentStatusSchema,
  /** Facts the model proposed from this document, pending confirmation. */
  proposedFacts: z.array(profileFactSchema),
  extraction: documentExtractionSchema,
  /** Whether this document may be sent to an AI provider. */
  consentToUse: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  /** Present when `status` is `failed`. */
  errorMessage: z.string().nullable(),
  /** Short-lived URL; never a permanent public link. */
  downloadUrl: z.string().nullable(),
});

export const documentListSchema = z.object({
  documents: z.array(documentSchema),
});

export const profileSnapshotSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateTimeSchema,
  facts: z.array(profileFactSchema),
});

/**
 * Whether the student has given, withheld or withdrawn their date of birth.
 */
export const dateOfBirthStatusSchema = z.enum(['not_provided', 'provided', 'declined', 'excluded']);
export type DateOfBirthStatus = z.infer<typeof dateOfBirthStatusSchema>;

/**
 * The protected part of the profile.
 *
 * The date of birth is *not* a fact: facts are sent to the model, this is
 * not. It is only ever used to check an age requirement, and only when the
 * student has agreed to that. The derived outcome of each age check is
 * exposed; the date itself is not.
 */
export const protectedProfileSchema = z.object({
  dateOfBirth: z.object({
    /** ISO date, `YYYY-MM-DD`. Null when it was never given. */
    value: z.string().nullable(),
    status: dateOfBirthStatusSchema,
    /** Where the value came from, when it came from somewhere. */
    source: z.string().nullable(),
    /** When the student last changed it. */
    updatedAt: isoDateTimeSchema,
    /** Whether the date may be used to check age requirements at all. */
    excludedFromAiContext: z.boolean(),
  }),
});
export type ProtectedProfile = z.infer<typeof protectedProfileSchema>;

export const protectedProfileResponseSchema = z.object({
  protectedProfile: protectedProfileSchema,
});

export const updateProtectedProfileRequestSchema = z.object({
  /** An ISO date, or null to withdraw it. */
  dateOfBirth: z.string().nullable().optional(),
  /** "prefer_not_to_say" withdraws it without giving a reason. */
  dateOfBirthStatus: dateOfBirthStatusSchema.optional(),
  /** Where the value came from, when it came from somewhere. */
  source: z.string().nullable().optional(),
  excludedFromAiContext: z.boolean().optional(),
});
export type UpdateProtectedProfileRequest = z.infer<typeof updateProtectedProfileRequestSchema>;

export const updateProfileRequestSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  preferences: profilePreferencesSchema.partial().optional(),
  consent: profileConsentSchema.partial().optional(),
});

export const confirmFactsRequestSchema = z.object({
  facts: z.array(
    z.object({
      id: uuidSchema,
      status: factStatusSchema,
      value: z.string().optional(),
    }),
  ),
});

/**
 * A review-history entry.
 *
 * Every change the student makes to a fact is recorded, so the passport can
 * show not only what Oppulse knows but how it came to know it.
 */
export const factRevisionActionSchema = z.enum([
  'confirmed',
  'corrected',
  'excluded',
  'rejected',
  'restored',
]);
export type FactRevisionAction = z.infer<typeof factRevisionActionSchema>;

export const profileFactRevisionSchema = z.object({
  id: uuidSchema,
  factId: uuidSchema,
  factLabel: z.string(),
  action: factRevisionActionSchema,
  previousValue: z.string().nullable(),
  newValue: z.string().nullable(),
  sourceDocumentName: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type ProfileFactRevision = z.infer<typeof profileFactRevisionSchema>;

export const profileRevisionsSchema = z.object({
  revisions: z.array(profileFactRevisionSchema),
});

/**
 * What a fact is holding up.
 *
 * For each fact key, the eligibility requirements that depend on it. This
 * is what turns "confirm this" from a chore into a decision with a
 * consequence the student can see.
 */
export const profileImpactSchema = z.object({
  impact: z.array(
    z.object({
      factKey: z.string(),
      requirements: z.array(
        z.object({
          opportunityId: uuidSchema,
          opportunityTitle: z.string(),
          requirementId: uuidSchema,
          requirementLabel: z.string(),
          status: z.enum(['likely', 'unresolved', 'ineligible', 'not_applicable']),
        }),
      ),
    }),
  ),
});
export type ProfileImpact = z.infer<typeof profileImpactSchema>;

/** The action taken on a single fact. */
export const updateFactRequestSchema = z.object({
  status: z.enum(['confirmed', 'rejected']).optional(),
  value: z.string().max(500).optional(),
  excluded: z.boolean().optional(),
});
export type UpdateFactRequest = z.infer<typeof updateFactRequestSchema>;

/** The response to a fact change: the fact, the new history and the impact. */
export const updateFactResponseSchema = z.object({
  fact: profileFactSchema,
  revisions: z.array(profileFactRevisionSchema),
  impact: z.array(
    z.object({
      factKey: z.string(),
      requirements: z.array(
        z.object({
          opportunityId: uuidSchema,
          opportunityTitle: z.string(),
          requirementId: uuidSchema,
          requirementLabel: z.string(),
          status: z.enum(['likely', 'unresolved', 'ineligible', 'not_applicable']),
        }),
      ),
    }),
  ),
});

/** The consent controls for one document. */
export const updateDocumentRequestSchema = z.object({
  consentToUse: z.boolean().optional(),
});
export type UpdateDocumentRequest = z.infer<typeof updateDocumentRequestSchema>;

export type Profile = z.infer<typeof profileSchema>;
export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;
export type ProfileConsent = z.infer<typeof profileConsentSchema>;
export type Document = z.infer<typeof documentSchema>;
export type DocumentCategory = z.infer<typeof documentCategorySchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type ConfirmFactsRequest = z.infer<typeof confirmFactsRequestSchema>;
