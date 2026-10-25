import type {
  Document,
  Profile,
  ProfileFact,
  ProfileSnapshot,
  ProtectedProfile,
  SessionUser,
} from '@/lib/schemas';

/**
 * Fixture identities.
 *
 * These are synthetic people and synthetic programmes. The prototype must
 * never assert a fact about a real institution — a judge reading the UI
 * would reasonably assume otherwise. Real opportunities only enter the
 * product once the backend has retrieved them from a live source.
 */

export const DEMO_USER: SessionUser = {
  id: '3f6b1a2c-9d84-4f1e-8a7b-0c2d5e7f9a11',
  email: 'sara.benali@example.edu',
  fullName: 'Sara Benali',
  avatarUrl: null,
  headline: "Master's student · Computational biology",
  // The demo student has not verified their address, so the interface shows
  // the gate: no sensitive alert is emailed until it is verified.
  emailVerified: false,
  emailVerifiedAt: null,
};

type FactInput = Omit<
  ProfileFact,
  'excluded' | 'conflicting' | 'updatedAt' | 'corrected' | 'conflict'
> &
  Partial<Pick<ProfileFact, 'corrected' | 'conflicting' | 'updatedAt' | 'conflict'>>;

/**
 * Builds a fact with the fields the interface always needs, so each fact
 * only states what is distinctive about it.
 */
function fact(input: FactInput): ProfileFact {
  return {
    ...input,
    corrected: input.corrected ?? false,
    excluded: false,
    conflicting: input.conflicting ?? false,
    conflict: input.conflict ?? null,
    updatedAt: input.updatedAt ?? '2026-10-18T21:04:00.000Z',
  };
}

export const DEMO_PROFILE: Profile = {
  id: '3f6b1a2c-9d84-4f1e-8a7b-0c2d5e7f9a11',
  fullName: 'Sara Benali',
  email: 'sara.benali@example.edu',
  avatarUrl: null,
  headline: "Master's student · Computational biology",
  facts: [
    fact({
      id: 'a1000000-0000-4000-8000-000000000001',
      key: 'degree_level',
      label: 'Current degree level',
      value: "Master's (2nd year)",
      status: 'confirmed',
      confidence: 'high',
      source: null,
      section: 'education',
      numericValue: 2,
      code: 'master',
      usedFor: 'Decides which programme types you are eligible for.',
    }),
    fact({
      id: 'a1000000-0000-4000-8000-000000000002',
      key: 'field',
      label: 'Field of study',
      value: 'Computational Biology and Bioinformatics',
      status: 'confirmed',
      confidence: 'high',
      source: {
        documentId: 'b2000000-0000-4000-8000-000000000001',
        documentName: 'Benali_CV.pdf',
        excerpt: 'MSc Computational Biology and Bioinformatics, University of Bab Ezzouar.',
        pageReference: 'p. 1',
        section: 'Education',
      },
      section: 'education',
      numericValue: null,
      code: null,
      usedFor: 'Matches you against each programme’s research area and technical requirements.',
    }),
    fact({
      id: 'a1000000-0000-4000-8000-000000000003',
      key: 'nationality',
      label: 'Nationality',
      value: 'Algeria',
      status: 'confirmed',
      confidence: 'high',
      source: {
        documentId: 'b2000000-0000-4000-8000-000000000001',
        documentName: 'Benali_CV.pdf',
        excerpt: 'Nationality: Algerian',
        pageReference: 'p. 1',
        section: 'Personal details',
      },
      section: 'about',
      numericValue: null,
      code: 'DZ',
      usedFor: 'Checks the nationality and residency clauses in each call.',
    }),
    fact({
      id: 'a1000000-0000-4000-8000-000000000004',
      key: 'graduation_year',
      label: 'Expected graduation',
      value: '2027',
      status: 'confirmed',
      confidence: 'medium',
      conflicting: true,
      conflict: {
        value: '2028',
        documentName: 'transcript_2026.pdf',
        pageReference: 'p. 1',
        excerpt: 'Academic year 2026/2027 — expected award 2028.',
      },
      source: {
        documentId: 'b2000000-0000-4000-8000-000000000001',
        documentName: 'Benali_CV.pdf',
        excerpt: 'Expected completion: June 2027',
        pageReference: 'p. 1',
        section: 'Education',
      },
      section: 'education',
      numericValue: 2027,
      code: null,
      usedFor: 'Determines whether your degree is complete in time for the programme start.',
    }),
    fact({
      id: 'a1000000-0000-4000-8000-000000000005',
      key: 'english_level',
      label: 'English (CEFR)',
      value: 'B2 (IELTS 6.5)',
      status: 'proposed',
      confidence: 'medium',
      source: {
        documentId: 'b2000000-0000-4000-8000-000000000003',
        documentName: 'IELTS_2025.pdf',
        excerpt: 'Overall band score 6.5, no band below 6.0.',
        pageReference: 'p. 1',
        section: 'Test results',
      },
      section: 'languages',
      numericValue: 6.5,
      code: 'B2',
      usedFor: 'Assesses the language requirement in each call.',
    }),
    fact({
      id: 'a1000000-0000-4000-8000-000000000006',
      key: 'skills',
      label: 'Technical skills',
      value: 'Python, PyTorch, R, SQL, Nextflow, scRNA-seq',
      status: 'confirmed',
      confidence: 'high',
      source: {
        documentId: 'b2000000-0000-4000-8000-000000000001',
        documentName: 'Benali_CV.pdf',
        excerpt: 'Technical: Python, PyTorch, R, SQL, Nextflow',
        pageReference: 'p. 2',
        section: 'Skills',
      },
      section: 'skills',
      numericValue: null,
      code: null,
      usedFor: 'Checks the software and method requirements a call lists.',
    }),
    fact({
      id: 'a1000000-0000-4000-8000-000000000007',
      key: 'publications',
      label: 'Publications',
      value: '1 first-author conference paper, 2 co-authored',
      status: 'proposed',
      confidence: 'low',
      source: {
        documentId: 'b2000000-0000-4000-8000-000000000001',
        documentName: 'Benali_CV.pdf',
        excerpt: 'Publications section — dates not legible in extracted text.',
        pageReference: 'p. 2',
        section: 'Publications',
      },
      section: 'experience',
      numericValue: 3,
      code: null,
      usedFor: 'Used where a call asks for research output.',
    }),
  ],
  preferences: {
    guidedView: true,
    email: {
      defaultCadence: 'daily_digest',
      categories: {
        deadline: 'daily_digest',
        source_change: 'immediate',
        run_complete: 'off',
        application_task: 'weekly_digest',
      },
    },
    timezone: 'Africa/Algiers',
    currency: 'EUR',
  },
  consent: {
    externalModelProcessing: true,
    allowProfileMatching: true,
    emailNotifications: true,
    retentionDays: null,
  },
  updatedAt: '2026-10-18T21:04:00.000Z',
};

/**
 * The protected part of the demo profile.
 *
 * The demo student has not given a date of birth, so the age requirements
 * in the prototype stay unresolved — which is the honest state, and the one
 * the interface has to explain rather than hide.
 */
export const DEMO_PROTECTED_PROFILE: ProtectedProfile = {
  dateOfBirth: {
    value: null,
    status: 'not_provided',
    source: null,
    updatedAt: '2026-10-18T21:04:00.000Z',
    excludedFromAiContext: false,
  },
};

export const DEMO_DOCUMENTS: Document[] = [
  {
    id: 'b2000000-0000-4000-8000-000000000001',
    filename: 'Benali_CV.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2_410_496,
    category: 'cv',
    status: 'processed',
    proposedFacts: [],
    extraction: {
      proposedFactIds: [
        'a1000000-0000-4000-8000-000000000002',
        'a1000000-0000-4000-8000-000000000003',
        'a1000000-0000-4000-8000-000000000004',
        'a1000000-0000-4000-8000-000000000006',
        'a1000000-0000-4000-8000-000000000007',
      ],
      unreadSections: [],
      method: 'text_layer',
      completedAt: '2026-10-16T09:13:41.000Z',
    },
    consentToUse: true,
    createdAt: '2026-10-16T09:12:00.000Z',
    updatedAt: '2026-10-16T09:13:41.000Z',
    errorMessage: null,
    downloadUrl: '/api/v1/documents/b2000000-0000-4000-8000-000000000001/content',
  },
  {
    id: 'b2000000-0000-4000-8000-000000000002',
    filename: 'transcript_2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_128_960,
    category: 'transcript',
    status: 'partial',
    proposedFacts: [],
    extraction: {
      proposedFactIds: [],
      unreadSections: [
        'The scanned signature page could not be read — it is an image with no text layer.',
      ],
      method: 'text_layer',
      completedAt: '2026-10-16T09:15:02.000Z',
    },
    // The student excluded this document: Oppulse may read it, but must not
    // send it to a model provider.
    consentToUse: false,
    createdAt: '2026-10-16T09:14:10.000Z',
    updatedAt: '2026-10-16T09:15:02.000Z',
    errorMessage: null,
    downloadUrl: '/api/v1/documents/b2000000-0000-4000-8000-000000000002/content',
  },
  {
    id: 'b2000000-0000-4000-8000-000000000003',
    filename: 'IELTS_2025.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 892_928,
    category: 'language',
    status: 'needs_review',
    proposedFacts: [
      fact({
        id: 'a1000000-0000-4000-8000-000000000005',
        key: 'english_level',
        label: 'English (CEFR)',
        value: 'B2 (IELTS 6.5)',
        status: 'proposed',
        confidence: 'medium',
        source: {
          documentId: 'b2000000-0000-4000-8000-000000000003',
          documentName: 'IELTS_2025.pdf',
          excerpt: 'Overall band score 6.5, no band below 6.0.',
          pageReference: 'p. 1',
          section: 'Test results',
        },
        section: 'languages',
        numericValue: 6.5,
        code: 'B2',
        usedFor: 'Assesses the language requirement in each call.',
      }),
    ],
    extraction: {
      proposedFactIds: ['a1000000-0000-4000-8000-000000000005'],
      unreadSections: [],
      method: 'text_layer',
      completedAt: '2026-10-16T09:17:11.000Z',
    },
    consentToUse: true,
    createdAt: '2026-10-16T09:16:30.000Z',
    updatedAt: '2026-10-16T09:17:11.000Z',
    errorMessage: null,
    downloadUrl: '/api/v1/documents/b2000000-0000-4000-8000-000000000003/content',
  },
  {
    id: 'b2000000-0000-4000-8000-000000000004',
    filename: 'conference_poster_2026.png',
    mimeType: 'image/png',
    sizeBytes: 3_774_873,
    category: 'other',
    status: 'failed',
    proposedFacts: [],
    extraction: {
      proposedFactIds: [],
      unreadSections: ['The poster is an image, and we do not run OCR on it.'],
      method: 'none',
      completedAt: '2026-10-17T18:02:09.000Z',
    },
    consentToUse: true,
    createdAt: '2026-10-17T18:02:00.000Z',
    updatedAt: '2026-10-17T18:02:09.000Z',
    errorMessage:
      'This file is an image, and reading images needs OCR. Upload the PDF version of the poster, or paste the text.',
    downloadUrl: null,
  },
];

export const DEMO_PROFILE_SNAPSHOT: ProfileSnapshot = {
  id: 'c3000000-0000-4000-8000-000000000001',
  createdAt: '2026-10-18T21:10:00.000Z',
  facts: DEMO_PROFILE.facts.filter((factItem) => factItem.status === 'confirmed'),
};
