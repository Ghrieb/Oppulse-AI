import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateRequirement, recomputeAll, buildImpact } from '../src/lib/matching';
import { deriveNextAction } from '../src/lib/next-action';
import { computeCompleteness } from '../src/lib/completeness';
import { deterministicUuid } from '../src/lib/ids';
import type { Opportunity, Profile, ProtectedProfile, Requirement } from '../src/lib/schemas';

/**
 * The shared rule cases.
 *
 * One file of cases, two implementations. The TypeScript is the reference:
 * its answers are recorded in `contracts/rule-cases.json`, and the Python
 * implementation in the backend is asserted against the same file. A
 * divergence fails both suites, in CI, on the case that disagrees.
 *
 * Regenerate the expectations after a deliberate rule change:
 *
 *     npm run cases:update
 */

const CASES_PATH = resolve(__dirname, '../../contracts/rule-cases.json');

interface RuleCase {
  name: string;
  kind: 'requirement' | 'next_action' | 'completeness';
  input: Record<string, unknown>;
  expected: Record<string, unknown> | null;
}

interface RuleCases {
  version: number;
  cases: RuleCase[];
}

function loadCases(): RuleCases {
  return JSON.parse(readFileSync(CASES_PATH, 'utf-8')) as RuleCases;
}

function compute(testCase: RuleCase): Record<string, unknown> | null {
  if (testCase.kind === 'requirement') {
    const result = evaluateRequirement(
      testCase.input.requirement as Requirement,
      testCase.input.profile as Profile | null,
      testCase.input.protectedProfile as ProtectedProfile | null,
    );
    return { status: result.status, explanation: result.explanation };
  }

  if (testCase.kind === 'next_action') {
    const action = deriveNextAction({
      profile: testCase.input.profile as Profile | null,
      opportunities: testCase.input.opportunities as Opportunity[],
      applications: testCase.input.applications as never[],
      drafts: testCase.input.drafts as never[],
      sources: testCase.input.sources as never[],
      alerts: testCase.input.alerts as never[],
      now: testCase.input.now as string,
    });
    return action;
  }

  const completeness = computeCompleteness(testCase.input.profile as Profile | null);
  return {
    confirmed: completeness.confirmed,
    required: completeness.required,
    percent: completeness.percent,
    summary: completeness.summary,
  };
}

describe('the shared rule cases', () => {
  it('the reference implementation still produces the recorded answers', () => {
    const cases = loadCases();
    expect(cases.cases.length).toBeGreaterThan(10);

    // A deliberate rule change regenerates the expectations; an accidental
    // one fails here, in both implementations.
    if (process.env.UPDATE_RULE_CASES === '1') {
      for (const testCase of cases.cases) {
        testCase.expected = compute(testCase);
      }
      writeFileSync(CASES_PATH, `${JSON.stringify(cases, null, 2)}\n`, 'utf-8');
      return;
    }

    for (const testCase of cases.cases) {
      expect(compute(testCase), testCase.name).toEqual(testCase.expected);
    }
  });
});

describe('the deterministic identifier', () => {
  it('is stable for the same seed', () => {
    expect(deterministicUuid('confirm-fact:abc')).toBe(deterministicUuid('confirm-fact:abc'));
    expect(deterministicUuid('confirm-fact:abc')).not.toBe(deterministicUuid('confirm-fact:abd'));
  });

  it('is a well-formed version 4 UUID', () => {
    expect(deterministicUuid('conflict:xyz')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('the recomputation', () => {
  it('re-evaluates every opportunity and assessment', () => {
    const opportunities = [
      {
        id: 'd4000000-0000-4000-8000-000000000001',
        title: 'Helios Research Fellowship in Computational Biology',
        requirements: [
          {
            id: '50000000-0000-4000-8000-000000000004',
            label: 'English proficiency',
            kind: 'language',
            status: 'unresolved',
            sourceClause: null,
            evidenceIds: [],
            profileFactKey: 'english_level',
            check: { factKey: 'english_level', kind: 'at_least', value: 6.5 },
            ageRule: null,
            blocking: true,
            explanation: '',
          },
        ],
      },
    ] as unknown as Opportunity[];

    const matches = [
      {
        id: '5e000000-0000-4000-8000-000000000001',
        opportunityId: 'd4000000-0000-4000-8000-000000000001',
        fitScore: 80,
        eligibility: 'unresolved',
        warnings: [],
        confidence: 'medium',
        reasons: [],
      },
    ] as never[];

    const profile = {
      facts: [
        {
          key: 'english_level',
          label: 'English (CEFR)',
          value: 'B2 (IELTS 6.5)',
          numericValue: 6.5,
          code: 'B2',
          status: 'confirmed',
          excluded: false,
          source: null,
        },
      ],
    } as unknown as Profile;

    const recomputed = recomputeAll(opportunities, matches, profile);

    expect(recomputed.opportunities[0]?.requirements[0]?.status).toBe('likely');
    expect(recomputed.matches[0]?.eligibility).toBe('likely');
    expect(recomputed.matches[0]?.warnings).toEqual([]);
  });

  it('reports only the requirements that are still blocking', () => {
    const opportunities = [
      {
        id: 'd4000000-0000-4000-8000-000000000001',
        title: 'Helios',
        requirements: [
          {
            id: '50000000-0000-4000-8000-000000000004',
            label: 'English proficiency',
            profileFactKey: 'english_level',
            status: 'unresolved',
          },
          {
            id: '50000000-0000-4000-8000-000000000005',
            label: 'Research field',
            profileFactKey: 'field',
            status: 'likely',
          },
        ],
      },
    ] as unknown as Opportunity[];

    const impact = buildImpact(opportunities);

    expect(impact).toHaveLength(1);
    expect(impact[0]?.factKey).toBe('english_level');
    expect(impact[0]?.requirements).toHaveLength(1);
  });
});
