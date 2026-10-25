import type { AgentRun, Mission, RunEvent } from '@/lib/schemas';

/**
 * Mission and agent-run fixtures.
 *
 * The run timeline deliberately contains only factual events — what was
 * retrieved, what failed, what was extracted. It never shows invented
 * internal reasoning (spec §6.3).
 */

export const DEMO_MISSIONS: Mission[] = [
  {
    id: '1b000000-0000-4000-8000-000000000001',
    title: 'Fully funded research internships in Europe',
    objective:
      'Find fully funded international research internships, fellowships and summer schools in computational biology, genetics and AI. Prioritise opportunities accepting Algerian applicants and Master’s students. Check whether my profile meets the requirements, identify funding gaps, and alert me when an opportunity is worth pursuing.',
    criteria: {
      opportunityTypes: ['research_internship', 'fellowship', 'summer_school'],
      academicInterests: ['Computational biology', 'Genomics', 'Machine learning'],
      destinations: ['Europe', 'North America'],
      destinationCountries: ['NL', 'CA', 'DE', 'GB'],
      educationLevel: 'master',
      fundingPreference: 'fully_funded',
      startPeriod: 'Summer 2027',
      useProfile: true,
      sourceScope: [
        'Official programme pages',
        'Fellowship directories',
        'University research offices',
      ],
    },
    status: 'active',
    source: 'onboarding',
    selectedDocumentIds: ['b2000000-0000-4000-8000-000000000001'],
    confirmedFactIds: [
      'a1000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000002',
    ],
    limitations: [
      'A deadline is only shown when the source page states it.',
      'Funding is reported as stated; the gap is calculated, not negotiated.',
    ],
    userConfirmedAt: '2026-10-17T20:22:00.000Z',
    monitoring: { enabled: true, frequency: 'daily' },
    latestRunId: '2c000000-0000-4000-8000-000000000001',
    createdAt: '2026-10-17T20:15:00.000Z',
    updatedAt: '2026-10-18T21:34:00.000Z',
  },
  {
    id: '1b000000-0000-4000-8000-000000000002',
    title: 'Doctoral positions in computational biology',
    objective:
      'Find PhD positions in computational biology and bioinformatics in Europe, ideally with full funding including salary.',
    criteria: {
      opportunityTypes: ['research_program', 'fellowship'],
      academicInterests: ['Computational biology', 'Bioinformatics'],
      destinations: ['Europe'],
      destinationCountries: ['NL', 'DE', 'GB'],
      educationLevel: 'phd',
      fundingPreference: 'fully_funded',
      startPeriod: '2027',
      useProfile: true,
      sourceScope: ['Official university job pages', 'Research institute career pages'],
    },
    status: 'paused',
    source: 'assistant',
    selectedDocumentIds: [],
    confirmedFactIds: [],
    limitations: [
      'Doctoral positions often need a supervisor contact, which the agent cannot send.',
    ],
    userConfirmedAt: '2026-10-18T08:52:00.000Z',
    monitoring: { enabled: false, frequency: 'weekly' },
    latestRunId: null,
    createdAt: '2026-10-18T08:40:00.000Z',
    updatedAt: '2026-10-18T09:02:00.000Z',
  },
];

export const DEMO_RUNS: AgentRun[] = [
  {
    id: '2c000000-0000-4000-8000-000000000001',
    missionId: '1b000000-0000-4000-8000-000000000001',
    status: 'completed',
    phase: 'done',
    summary: {
      sourcesReviewed: 9,
      candidatesFound: 7,
      needingVerification: 2,
      unreachable: 1,
    },
    error: null,
    budgetUsed: {
      modelCalls: 14,
      searchCalls: 6,
      fetchedSources: 10,
      elapsedSeconds: 142,
    },
    startedAt: '2026-10-18T21:10:12.000Z',
    finishedAt: '2026-10-18T21:12:34.000Z',
  },
];

export const DEMO_RUN_EVENTS: RunEvent[] = [
  {
    id: '3d000000-0000-4000-8000-000000000001',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'run.queued',
    message: 'Run queued. The worker will pick this up shortly.',
    data: null,
    createdAt: '2026-10-18T21:10:12.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000002',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'understanding.started',
    message: 'Interpreting the mission into a search plan.',
    data: null,
    createdAt: '2026-10-18T21:10:14.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000003',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'understanding.completed',
    message:
      'Plan built: 4 interest clusters, 2 destination regions, fully-funded priority, Master’s level.',
    data: { queries: 6, sourceScope: 3 },
    createdAt: '2026-10-18T21:10:21.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000004',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'search.started',
    message: 'Searching 6 supported sources for candidate programmes.',
    data: { queries: 6 },
    createdAt: '2026-10-18T21:10:22.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000005',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'source.retrieved',
    message: 'Retrieved source: Helios Fellowship — Computational Biology.',
    data: { domain: 'helios-fellowship.org', quality: 'official' },
    createdAt: '2026-10-18T21:12:04.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000006',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'source.retrieved',
    message: 'Retrieved source: Atlas Global Graduate Scholarship — 2027 cohort.',
    data: { domain: 'atlas-scholarship.ca', quality: 'official' },
    createdAt: '2026-10-18T21:15:35.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000007',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'source.unavailable',
    message:
      'Source unavailable: Northwind Summer Research Programme. The site did not respond within 15 seconds.',
    data: { domain: 'northwind-program.org' },
    createdAt: '2026-10-18T21:21:40.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000008',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'requirements.extracted',
    message: 'Extracted programme requirements and funding clauses for 6 candidates.',
    data: { candidates: 6 },
    createdAt: '2026-10-18T21:24:00.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000009',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'eligibility.evaluated',
    message:
      'Checked 14 requirements against your confirmed profile: 11 met, 3 unresolved, 0 failed.',
    data: { met: 11, unresolved: 3, failed: 0 },
    createdAt: '2026-10-18T21:27:00.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000010',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'deadline.extracted',
    message: 'Extracted 5 deadlines. Two sources disagree on the Verdant closing date.',
    data: { extracted: 5, conflicts: 1 },
    createdAt: '2026-10-18T21:28:30.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000011',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'profile.needs_confirmation',
    message:
      'Your IELTS result is still awaiting confirmation, so 2 requirements could not be resolved.',
    data: { facts: 1, blockedRequirements: 2 },
    createdAt: '2026-10-18T21:29:00.000Z',
  },
  {
    id: '3d000000-0000-4000-8000-000000000012',
    runId: '2c000000-0000-4000-8000-000000000001',
    type: 'run.completed',
    message:
      'Reviewed 9 accessible sources. Found 7 candidate opportunities. 2 need eligibility verification. One source could not be reached.',
    data: { sourcesReviewed: 9, candidatesFound: 7, unreachable: 1 },
    createdAt: '2026-10-18T21:34:00.000Z',
  },
];
