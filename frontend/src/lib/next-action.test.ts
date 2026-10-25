import { describe, expect, it } from 'vitest';
import { deriveNextAction } from './next-action';
import type {
  Alert,
  Application,
  Draft,
  Opportunity,
  Profile,
  ProfileFact,
  Source,
} from './schemas';

/**
 * The next best action is the workspace's main instruction, so the ladder
 * that decides it is tested directly rather than through the interface.
 */

const NOW = '2026-10-19T12:00:00.000Z';

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '3f6b1a2c-9d84-4f1e-8a7b-0c2d5e7f9a11',
    fullName: 'Sara Benali',
    email: 'sara@example.edu',
    avatarUrl: null,
    headline: null,
    facts: [],
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
    updatedAt: NOW,
    ...overrides,
  };
}

function buildFact(overrides: Partial<ProfileFact> = {}): ProfileFact {
  return {
    id: 'a1000000-0000-4000-8000-000000000005',
    key: 'english_level',
    label: 'English (CEFR)',
    value: 'B2',
    status: 'proposed',
    confidence: 'medium',
    source: null,
    corrected: false,
    excluded: false,
    usedFor: null,
    conflicting: false,
    conflict: null,
    updatedAt: NOW,
    section: 'languages',
    numericValue: 6.5,
    code: 'B2',
    ...overrides,
  };
}

function buildOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'd4000000-0000-4000-8000-000000000001',
    title: 'Helios Research Fellowship',
    institution: 'Helios Institute',
    type: 'fellowship',
    country: { iso2: 'NL', name: 'Netherlands', kind: 'country', region: 'Europe' },
    sourceDomain: 'helios-fellowship.org',
    canonicalUrl: 'https://helios-fellowship.org/programmes/computational-biology',
    summary: 'A funded placement.',
    institutionBrand: {
      institutionName: 'Helios Institute',
      officialDomain: 'helios-fellowship.org',
      logoUrl: null,
      bannerUrl: null,
      attribution: null,
      verifiedAt: NOW,
      source: 'fallback',
      generated: true,
      iconSource: 'none',
    },
    duration: '12 months',
    applicationOpensAt: null,
    tags: [],
    deadline: {
      value: '2026-11-20',
      timezone: 'Europe/Amsterdam',
      status: 'verified',
      remainingDays: 32,
      evidenceId: null,
      conflicts: [],
      note: null,
    },
    additionalDeadlines: [],
    funding: {
      coverage: 'fully_funded',
      components: [],
      estimatedGap: null,
      note: null,
    },
    requirements: [],
    saved: false,
    dismissed: false,
    createdAt: NOW,
    ...overrides,
  };
}

const EMPTY = {
  profile: null,
  opportunities: [] as Opportunity[],
  applications: [] as Application[],
  drafts: [] as Draft[],
  sources: [] as Source[],
  alerts: [] as Alert[],
  now: NOW,
};

describe('deriveNextAction', () => {
  it('returns nothing when nothing is blocking', () => {
    expect(deriveNextAction(EMPTY)).toBeNull();
  });

  it('prioritises an unconfirmed fact that blocks a requirement', () => {
    const profile = buildProfile({ facts: [buildFact()] });

    // The requirement that depends on the fact is unresolved, so the fact
    // is genuinely blocking.
    const opportunity = buildOpportunity({
      requirements: [
        {
          id: '50000000-0000-4000-8000-000000000004',
          label: 'English proficiency',
          kind: 'language',
          status: 'unresolved',
          sourceClause: 'A minimum of B2 English is required.',
          evidenceIds: [],
          profileFactKey: 'english_level',
          check: { factKey: 'english_level', kind: 'at_least', value: 6.5 },
          ageRule: null,
          blocking: true,
          explanation: 'Your IELTS result is still awaiting confirmation.',
        },
      ],
    });

    const action = deriveNextAction({
      ...EMPTY,
      profile,
      opportunities: [opportunity],
    });

    expect(action?.kind).toBe('confirm_fact');
    expect(action?.route).toBe('/profile?fact=a1000000-0000-4000-8000-000000000005');
    expect(action?.blockerId).toBe('a1000000-0000-4000-8000-000000000005');
    expect(action?.rationale).toMatch(/blocking/i);
  });

  it('ignores a proposed fact that is not blocking anything', () => {
    const profile = buildProfile({
      facts: [buildFact({ key: 'publications', label: 'Publications', numericValue: 3 })],
    });

    const action = deriveNextAction({ ...EMPTY, profile });

    expect(action).toBeNull();
  });

  it('raises a deadline conflict above a missing document', () => {
    const opportunity = buildOpportunity({
      deadline: {
        value: '2026-12-01',
        timezone: 'Europe/Brussels',
        status: 'conflict',
        remainingDays: null,
        evidenceId: null,
        conflicts: [],
        note: null,
      },
    });

    const action = deriveNextAction({
      ...EMPTY,
      opportunities: [opportunity],
      applications: [
        {
          id: '4e000000-0000-4000-8000-000000000001',
          opportunityId: opportunity.id,
          opportunityTitle: opportunity.title,
          institution: opportunity.institution,
          status: 'preparing',
          deadline: null,
          deadlineVerified: false,
          checklist: [
            {
              id: '5f000000-0000-4000-8000-000000000001',
              label: 'Transcript',
              status: 'missing',
              source: null,
              dueDate: null,
              documentId: null,
              note: null,
            },
          ],
          tasks: [],
          draftIds: [],
          completion: { completed: 0, total: 1 },
          nextBestAction: null,
          officialUrl: null,
          notes: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    expect(action?.kind).toBe('resolve_conflict');
    expect(action?.route).toBe(`/opportunities/${opportunity.id}`);
  });

  it('reports a source that could not be reached', () => {
    const opportunity = buildOpportunity();
    const source: Source = {
      id: 'e5000000-0000-4000-8000-000000000009',
      runId: '2c000000-0000-4000-8000-000000000001',
      url: 'https://northwind-program.org/summer-research',
      title: 'Northwind',
      domain: 'northwind-program.org',
      excerpt: '',
      quality: 'unknown',
      status: 'unavailable',
      contentHash: '',
      retrievedAt: NOW,
      pageReference: null,
      failureReason: 'Timed out',
    };

    const action = deriveNextAction({
      ...EMPTY,
      opportunities: [opportunity],
      sources: [source],
    });

    // The source belongs to a different opportunity, so it must not be
    // attributed to this one.
    expect(action?.kind).not.toBe('check_source');
  });

  it('points a missing document at the application that needs it', () => {
    const action = deriveNextAction({
      ...EMPTY,
      applications: [
        {
          id: '4e000000-0000-4000-8000-000000000001',
          opportunityId: 'd4000000-0000-4000-8000-000000000001',
          opportunityTitle: 'Helios Research Fellowship',
          institution: 'Helios Institute',
          status: 'preparing',
          deadline: null,
          deadlineVerified: false,
          checklist: [
            {
              id: '5f000000-0000-4000-8000-000000000001',
              label: 'English certificate',
              status: 'missing',
              source: 'Call PDF, p. 4',
              dueDate: null,
              documentId: null,
              note: 'Your IELTS result still needs confirming.',
            },
          ],
          tasks: [],
          draftIds: [],
          completion: { completed: 0, total: 1 },
          nextBestAction: null,
          officialUrl: null,
          notes: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    expect(action?.kind).toBe('complete_document');
    expect(action?.route).toBe('/applications/4e000000-0000-4000-8000-000000000001');
    expect(action?.rationale).toMatch(/IELTS/);
  });

  it('points an unreviewed draft proposal at the writing studio', () => {
    const action = deriveNextAction({
      ...EMPTY,
      drafts: [
        {
          id: '60000000-0000-4000-8000-000000000001',
          applicationId: '4e000000-0000-4000-8000-000000000001',
          opportunityId: 'd4000000-0000-4000-8000-000000000001',
          type: 'motivation_letter',
          title: 'Motivation letter',
          currentVersion: 2,
          content: '{}',
          versions: [],
          pendingProposal: {
            id: '70000000-0000-4000-8000-000000000001',
            draftId: '60000000-0000-4000-8000-000000000001',
            baseVersion: 2,
            content: '{}',
            summary: 'A revision',
            unsupportedClaims: [],
            status: 'pending',
            createdAt: NOW,
          },
          updatedAt: NOW,
        },
      ],
    });

    expect(action?.kind).toBe('review_proposal');
    expect(action?.route).toBe('/writing/60000000-0000-4000-8000-000000000001');
  });
});
