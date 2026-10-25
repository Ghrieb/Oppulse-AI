import type { RunEvent, RunPhase, RunStatus } from '@/lib/schemas';
import { getState, type SimulatedRun } from './state';

/**
 * Deterministic run simulation.
 *
 * A simulated run's state is derived from how long it has been running
 * rather than from timers. That mirrors the real backend, where a run
 * survives a browser refresh and resumes from persisted state, and it keeps
 * tests deterministic without fake-timer gymnastics.
 */

export const PHASE_SEQUENCE: ReadonlyArray<{
  phase: RunPhase;
  status: RunStatus;
  afterMs: number;
}> = [
  { phase: 'queued', status: 'queued', afterMs: 0 },
  { phase: 'understanding', status: 'running', afterMs: 1_200 },
  { phase: 'searching', status: 'running', afterMs: 3_000 },
  { phase: 'fetching', status: 'running', afterMs: 5_500 },
  { phase: 'extracting', status: 'running', afterMs: 8_000 },
  { phase: 'evaluating', status: 'running', afterMs: 11_000 },
  { phase: 'saving', status: 'running', afterMs: 14_000 },
  { phase: 'done', status: 'completed', afterMs: 17_000 },
];

export interface DerivedRunState {
  phase: RunPhase;
  status: RunStatus;
  elapsedMs: number;
}

/** The event script a simulated run emits as it progresses. */
const SIMULATED_EVENTS: ReadonlyArray<{
  afterMs: number;
  event: Omit<RunEvent, 'id' | 'runId' | 'createdAt'>;
}> = [
  {
    afterMs: 0,
    event: {
      type: 'run.queued',
      message: 'Run queued. The worker will pick this up shortly.',
      data: null,
    },
  },
  {
    afterMs: 1_200,
    event: {
      type: 'understanding.started',
      message: 'Interpreting the mission into a search plan.',
      data: null,
    },
  },
  {
    afterMs: 2_400,
    event: {
      type: 'understanding.completed',
      message: 'Plan built: 4 interest clusters, 2 destination regions, fully-funded priority.',
      data: { queries: 6 },
    },
  },
  {
    afterMs: 3_000,
    event: {
      type: 'search.started',
      message: 'Searching 6 supported sources for candidate programmes.',
      data: { queries: 6 },
    },
  },
  {
    afterMs: 4_500,
    event: {
      type: 'source.retrieved',
      message: 'Retrieved source: Helios Fellowship — Computational Biology.',
      data: { domain: 'helios-fellowship.org', quality: 'official' },
    },
  },
  {
    afterMs: 5_500,
    event: {
      type: 'source.retrieved',
      message: 'Retrieved source: Atlas Global Graduate Scholarship — 2027 cohort.',
      data: { domain: 'atlas-scholarship.ca', quality: 'official' },
    },
  },
  {
    afterMs: 6_800,
    event: {
      type: 'source.unavailable',
      message:
        'Source unavailable: Northwind Summer Research Programme. The site did not respond within 15 seconds.',
      data: { domain: 'northwind-program.org' },
    },
  },
  {
    afterMs: 8_000,
    event: {
      type: 'requirements.extracted',
      message: 'Extracted programme requirements and funding clauses for 6 candidates.',
      data: { candidates: 6 },
    },
  },
  {
    afterMs: 11_000,
    event: {
      type: 'eligibility.evaluated',
      message:
        'Checked 14 requirements against your confirmed profile: 11 met, 3 unresolved, 0 failed.',
      data: { met: 11, unresolved: 3, failed: 0 },
    },
  },
  {
    afterMs: 13_000,
    event: {
      type: 'deadline.extracted',
      message: 'Extracted 5 deadlines. Two sources disagree on the Verdant closing date.',
      data: { extracted: 5, conflicts: 1 },
    },
  },
  {
    afterMs: 14_000,
    event: {
      type: 'profile.needs_confirmation',
      message:
        'Your IELTS result is still awaiting confirmation, so 2 requirements could not be resolved.',
      data: { facts: 1, blockedRequirements: 2 },
    },
  },
  {
    afterMs: 17_000,
    event: {
      type: 'run.completed',
      message:
        'Reviewed 9 accessible sources. Found 7 candidate opportunities. 2 need eligibility verification. One source could not be reached.',
      data: { sourcesReviewed: 9, candidatesFound: 7, unreachable: 1 },
    },
  },
];

export function deriveRunState(run: SimulatedRun, nowMs: number = Date.now()): DerivedRunState {
  // A paused or cancelled run's clock stops, so a refresh while paused still
  // shows the phase it paused on — the same as the backend, where the
  // checkpoint decides what is shown rather than wall time.
  const reference = run.cancelledAtMs ?? run.pausedAtMs ?? nowMs;
  const elapsedMs = Math.max(0, reference - run.startedAtMs);
  let phase: RunPhase = 'queued';
  let status: RunStatus = 'queued';

  for (const step of PHASE_SEQUENCE) {
    if (elapsedMs >= step.afterMs) {
      phase = step.phase;
      status = step.status;
    }
  }

  if (run.cancelledAtMs != null) {
    status = 'cancelled';
  } else if (run.pausedAtMs != null && status !== 'completed' && status !== 'cancelled') {
    status = 'paused';
  }

  return { phase, status, elapsedMs };
}

/** The events a simulated run has emitted so far. */
export function simulatedRunEvents(run: SimulatedRun, nowMs: number = Date.now()): RunEvent[] {
  const reference = run.cancelledAtMs ?? run.pausedAtMs ?? nowMs;
  const elapsedMs = Math.max(0, reference - run.startedAtMs);
  const script = SIMULATED_EVENTS.filter((entry) => elapsedMs >= entry.afterMs).map(
    (entry, index) => ({
      ...entry.event,
      id: `3e000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      runId: run.id,
      createdAt: new Date(run.startedAtMs + entry.afterMs).toISOString(),
    }),
  );

  // The control events (paused, resumed) are written, not derived, and
  // they sit in the timeline at the moment they happened.
  return [...script, ...(run.controlEvents ?? [])].sort((a, b) =>
    a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? -1 : 1,
  );
}

export function findSimulatedRun(runId: string): SimulatedRun | undefined {
  return getState().simulatedRuns.find((run) => run.id === runId);
}
