import type { Application, Draft } from '@/lib/schemas';

/**
 * Application workspace and writing-studio fixtures.
 */

export const DEMO_APPLICATIONS: Application[] = [
  {
    id: '4e000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000001',
    opportunityTitle: 'Helios Research Fellowship in Computational Biology',
    institution: 'Helios Institute for Applied Genomics',
    status: 'preparing',
    deadline: '2026-11-20',
    deadlineVerified: true,
    checklist: [
      {
        id: '5f000000-0000-4000-8000-000000000001',
        label: 'Research proposal (2 pages)',
        status: 'ready',
        source: 'Call PDF, p. 3',
        dueDate: '2026-11-05',
        documentId: null,
        note: null,
      },
      {
        id: '5f000000-0000-4000-8000-000000000002',
        label: 'Curriculum vitae',
        status: 'done',
        source: 'Call PDF, p. 3',
        dueDate: null,
        documentId: 'b2000000-0000-4000-8000-000000000001',
        note: null,
      },
      {
        id: '5f000000-0000-4000-8000-000000000003',
        label: 'Two academic reference letters',
        status: 'needs_attention',
        source: 'Call PDF, p. 4',
        dueDate: '2026-11-10',
        documentId: null,
        note: 'References must come from a lecturer at your current university.',
      },
      {
        id: '5f000000-0000-4000-8000-000000000004',
        label: 'Proof of enrolment',
        status: 'done',
        source: 'Call PDF, p. 3',
        dueDate: null,
        documentId: 'b2000000-0000-4000-8000-000000000002',
        note: null,
      },
      {
        id: '5f000000-0000-4000-8000-000000000005',
        label: 'English proficiency certificate',
        status: 'missing',
        source: 'Call PDF, p. 4',
        dueDate: '2026-11-10',
        documentId: null,
        note: 'Accepted: IELTS, TOEFL or Cambridge. Your IELTS result still needs confirming.',
      },
      {
        id: '5f000000-0000-4000-8000-000000000006',
        label: 'Code sample and research interest statement',
        status: 'ready',
        source: 'Call PDF, p. 5',
        dueDate: null,
        documentId: null,
        note: null,
      },
    ],
    tasks: [
      {
        id: '5f000000-0000-4000-8000-000000000101',
        label: 'Confirm IELTS score on your profile',
        status: 'doing',
        dueDate: '2026-10-22',
        blockedReason: null,
      },
      {
        id: '5f000000-0000-4000-8000-000000000102',
        label: 'Ask Dr. Haddad for a reference letter',
        status: 'todo',
        dueDate: '2026-10-30',
        blockedReason: null,
      },
      {
        id: '5f000000-0000-4000-8000-000000000103',
        label: 'Draft the research proposal',
        status: 'todo',
        dueDate: '2026-11-05',
        blockedReason: null,
      },
      {
        id: '5f000000-0000-4000-8000-000000000104',
        label: 'Request the transcript from the registry',
        status: 'done',
        dueDate: '2026-10-18',
        blockedReason: null,
      },
    ],
    draftIds: ['60000000-0000-4000-8000-000000000001'],
    completion: { completed: 2, total: 6 },
    nextBestAction:
      'Confirm your IELTS score — it is the only thing blocking two checklist items and one requirement.',
    officialUrl: 'https://helios-fellowship.org/programmes/computational-biology',
    notes: 'Ask whether the placement can be extended to 24 months, as the listing suggests.',
    createdAt: '2026-10-18T21:40:00.000Z',
    updatedAt: '2026-10-19T08:12:00.000Z',
  },
  {
    id: '4e000000-0000-4000-8000-000000000002',
    opportunityId: 'd4000000-0000-4000-8000-000000000003',
    opportunityTitle: 'Atlas Global Graduate Scholarship — 2027 cohort',
    institution: 'Atlas Foundation',
    status: 'considering',
    deadline: '2026-11-28',
    deadlineVerified: true,
    checklist: [
      {
        id: '5f000000-0000-4000-8000-000000000201',
        label: 'Admission offer from a participating institution',
        status: 'missing',
        source: 'Scholarship page, Eligibility',
        dueDate: '2026-11-20',
        documentId: null,
        note: 'A university application is the real constraint here, not the scholarship.',
      },
      {
        id: '5f000000-0000-4000-8000-000000000202',
        label: 'Curriculum vitae',
        status: 'done',
        source: 'Scholarship page, Documents',
        dueDate: null,
        documentId: 'b2000000-0000-4000-8000-000000000001',
        note: null,
      },
      {
        id: '5f000000-0000-4000-8000-000000000203',
        label: 'Language proficiency scores',
        status: 'needs_attention',
        source: 'Scholarship page, Documents',
        dueDate: '2026-11-20',
        documentId: 'b2000000-0000-4000-8000-000000000003',
        note: 'The required score varies by institution — check yours.',
      },
    ],
    tasks: [
      {
        id: '5f000000-0000-4000-8000-000000000201',
        label: 'Shortlist two Canadian institutions',
        status: 'todo',
        dueDate: '2026-10-25',
        blockedReason: null,
      },
    ],
    draftIds: [],
    completion: { completed: 1, total: 3 },
    nextBestAction:
      'Shortlist two participating Canadian institutions — the scholarship depends on a university offer you do not have yet.',
    officialUrl: 'https://atlas-scholarship.ca/graduate/2027',
    notes: null,
    createdAt: '2026-10-18T21:42:00.000Z',
    updatedAt: '2026-10-18T21:42:00.000Z',
  },
];

/** Tiptap document JSON, kept as a string exactly as the API returns it. */
const MOTIVATION_LETTER_V1 = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Dear Selection Committee,',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'I am writing to apply for the Helios Research Fellowship in Computational Biology. I am a second-year Master’s student in Computational Biology and Bioinformatics, and my work focuses on single-cell RNA-seq analysis for immune response modelling.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'During my thesis I built a reproducible pipeline in Nextflow and Python that processes roughly 12,000 cells per run, and I presented the results at a national conference last spring.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'I would bring a computational background, a working knowledge of PyTorch and R, and the willingness to spend a year inside a host laboratory learning its methods deeply.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Sincerely, Sara Benali',
        },
      ],
    },
  ],
});

const MOTIVATION_LETTER_V2 = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Dear Selection Committee,',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'I am writing to apply for the Helios Research Fellowship in Computational Biology, and to propose work on interpretable single-cell models for host–pathogen response. I am a second-year Master’s student in Computational Biology and Bioinformatics at the University of Bab Ezzouar.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'My thesis centres on single-cell RNA-seq analysis for immune response modelling. I built a reproducible Nextflow and Python pipeline that processes roughly 12,000 cells per run, cutting the analysis stage from eleven hours to under two, and I presented the results at a national conference last spring.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'A twelve-month placement in a computational genomics group is the clearest next step for me: I would bring a working knowledge of PyTorch, R and single-cell pipelines, and I would gain the laboratory methods I currently lack.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'I have attached a two-page proposal outlining a first-year project on batch correction across tissues, and I would be glad to discuss it further.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Sincerely, Sara Benali',
        },
      ],
    },
  ],
});

export const DEMO_DRAFTS: Draft[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    applicationId: '4e000000-0000-4000-8000-000000000001',
    opportunityId: 'd4000000-0000-4000-8000-000000000001',
    type: 'motivation_letter',
    title: 'Motivation letter — Helios Fellowship',
    currentVersion: 2,
    content: MOTIVATION_LETTER_V2,
    versions: [
      {
        version: 1,
        content: MOTIVATION_LETTER_V1,
        createdAt: '2026-10-18T22:10:00.000Z',
        source: 'created',
        summary: 'First draft generated from the opportunity and confirmed profile facts.',
      },
      {
        version: 2,
        content: MOTIVATION_LETTER_V2,
        createdAt: '2026-10-19T07:55:00.000Z',
        source: 'user',
        summary: 'Added the host-laboratory specifics and the attached-proposal sentence.',
      },
    ],
    pendingProposal: {
      id: '70000000-0000-4000-8000-000000000001',
      draftId: '60000000-0000-4000-8000-000000000001',
      baseVersion: 2,
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Dear Selection Committee,',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'I am writing to apply for the Helios Research Fellowship in Computational Biology, and to propose work on interpretable single-cell models for host–pathogen response. I am a second-year Master’s student in Computational Biology and Bioinformatics at the University of Bab Ezzouar.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'My thesis centres on single-cell RNA-seq analysis for immune response modelling. I built a reproducible Nextflow and Python pipeline that processes roughly 12,000 cells per run, cutting the analysis stage from eleven hours to under two, and I presented the results at a national conference last spring.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'The fellowship’s genomics groups work on batch correction across tissues, which is precisely the problem my pipeline was built to solve. A twelve-month placement would let me extend the method beyond immune cells and learn the laboratory techniques I currently lack.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'I have attached a two-page proposal outlining a first-year project on batch correction across tissues, and I would be glad to discuss it further.',
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Sincerely, Sara Benali',
              },
            ],
          },
        ],
      }),
      summary:
        'Ties the third paragraph to the host laboratory’s stated research direction and adds one sentence linking your pipeline to that work.',
      unsupportedClaims: [
        'The phrase "the fellowship’s genomics groups work on batch correction across tissues" is drawn from the call’s research themes; confirm it against the specific host group before submitting.',
      ],
      status: 'pending',
      createdAt: '2026-10-19T08:10:00.000Z',
    },
    updatedAt: '2026-10-19T08:10:00.000Z',
  },
];
