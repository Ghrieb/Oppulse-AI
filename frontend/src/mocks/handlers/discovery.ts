import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { applyChaos } from '../chaos';
import { getState, persistRuns } from '../state';
import { deriveRunState, simulatedRunEvents } from '../simulate';
import type { AgentRun, RunEvent } from '@/lib/schemas';

async function pause(): Promise<void> {
  await delay(45);
}

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

export const missionHandlers = [
  http.get(apiUrl('/missions'), async () => {
    const chaos = await applyChaos('/missions');
    if (chaos) return chaos;
    await pause();
    return HttpResponse.json({ missions: getState().missions });
  }),

  http.post(apiUrl('/missions'), async ({ request }) => {
    const chaos = await applyChaos('/missions');
    if (chaos) return chaos;
    await pause();

    const body = (await request.json()) as { title?: string; objective?: string };
    const state = getState();
    const now = new Date().toISOString();

    const mission = {
      id: `1b000000-0000-4000-8000-${String(state.missions.length + 1).padStart(12, '0')}`,
      title: body.title ?? 'Untitled mission',
      objective: body.objective ?? '',
      criteria: state.missions[0]?.criteria ?? {
        opportunityTypes: [],
        academicInterests: [],
        destinations: [],
        destinationCountries: [],
        educationLevel: 'any' as const,
        fundingPreference: 'any' as const,
        startPeriod: '',
        useProfile: true,
        sourceScope: [],
      },
      status: 'draft' as const,
      source: 'manual' as const,
      selectedDocumentIds: [],
      confirmedFactIds: [],
      limitations: [],
      userConfirmedAt: null,
      monitoring: { enabled: false, frequency: 'weekly' as const },
      latestRunId: null,
      createdAt: now,
      updatedAt: now,
    };

    state.missions.unshift(mission);
    return HttpResponse.json(mission, { status: 201 });
  }),

  http.get(apiUrl('/missions/:id'), async ({ params }) => {
    const chaos = await applyChaos('/missions');
    if (chaos) return chaos;
    await pause();

    const mission = getState().missions.find((item) => item.id === params.id);
    if (!mission) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That mission no longer exists.' } },
        { status: 404 },
      );
    }
    return HttpResponse.json(mission);
  }),

  http.patch(apiUrl('/missions/:id'), async ({ params, request }) => {
    const chaos = await applyChaos('/missions');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const mission = state.missions.find((item) => item.id === params.id);
    if (!mission) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That mission no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(mission, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json(mission);
  }),

  /**
   * Starts a bounded research run. The response is `202 Accepted` with a run
   * id — it never waits for the research to complete.
   */
  http.post(apiUrl('/missions/:id/runs'), async ({ params }) => {
    const chaos = await applyChaos('/runs');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const mission = state.missions.find((item) => item.id === params.id);
    if (!mission) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That mission no longer exists.' } },
        { status: 404 },
      );
    }

    const runId = `2c000000-0000-4000-8000-${String(state.simulatedRuns.length + 10).padStart(12, '0')}`;
    state.simulatedRuns.push({ id: runId, missionId: mission.id, startedAtMs: Date.now() });
    persistRuns();
    mission.latestRunId = runId;
    mission.status = 'active';
    mission.updatedAt = new Date().toISOString();

    return HttpResponse.json({ runId, status: 'queued' }, { status: 202 });
  }),
];

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

function buildSimulatedRun(runId: string, missionId: string): AgentRun {
  // The state has to come from the *stored* run: its clock (and its
  // paused instant) is what decides the phase and the status, the same
  // way the backend reads the row rather than the request.
  const simulated = getState().simulatedRuns.find((run) => run.id === runId);
  const derived = deriveRunState(
    simulated ?? { id: runId, missionId, startedAtMs: Date.now() },
    Date.now(),
  );

  return {
    id: runId,
    missionId,
    status: derived.status,
    phase: derived.phase,
    summary:
      derived.status === 'completed'
        ? {
            sourcesReviewed: 9,
            candidatesFound: 7,
            needingVerification: 2,
            unreachable: 1,
          }
        : null,
    error: null,
    budgetUsed: {
      modelCalls: Math.round(derived.elapsedMs / 900),
      searchCalls: derived.elapsedMs > 3000 ? 6 : 0,
      fetchedSources: derived.elapsedMs > 5500 ? 8 : 0,
      elapsedSeconds: Math.round(derived.elapsedMs / 1000),
    },
    startedAt: new Date(simulated?.startedAtMs ?? Date.now()).toISOString(),
    finishedAt:
      derived.status === 'completed'
        ? new Date().toISOString()
        : derived.status === 'cancelled' && simulated?.cancelledAtMs != null
          ? new Date(simulated.cancelledAtMs).toISOString()
          : null,
  };
}

export const runHandlers = [
  http.get(apiUrl('/runs/:id'), async ({ params }) => {
    const chaos = await applyChaos('/runs');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const fixtureRun = state.runs.find((run) => run.id === params.id);
    if (fixtureRun) return HttpResponse.json(fixtureRun);

    const simulated = state.simulatedRuns.find((run) => run.id === params.id);
    if (simulated) return HttpResponse.json(buildSimulatedRun(simulated.id, simulated.missionId));

    return HttpResponse.json(
      { error: { code: 'NOT_FOUND', message: 'That run no longer exists.' } },
      { status: 404 },
    );
  }),

  http.get(apiUrl('/runs/:id/events'), async ({ params }) => {
    const chaos = await applyChaos('/runs');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const fixtureEvents = state.runEvents.filter((event) => event.runId === params.id);
    if (fixtureEvents.length > 0) {
      return HttpResponse.json({ events: fixtureEvents, nextCursor: null });
    }

    const simulated = state.simulatedRuns.find((run) => run.id === params.id);
    if (simulated) {
      const events: RunEvent[] = simulatedRunEvents(simulated);
      return HttpResponse.json({ events, nextCursor: null });
    }

    return HttpResponse.json(
      { error: { code: 'NOT_FOUND', message: 'That run no longer exists.' } },
      { status: 404 },
    );
  }),

  /**
   * Cancels a run. The run row survives as cancelled — the backend never
   * deletes one — and the timeline freezes at the cancellation instant.
   */
  http.post(apiUrl('/runs/:id/cancel'), async ({ params }) => {
    const chaos = await applyChaos('/runs');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const fixtureRun = state.runs.find((run) => run.id === params.id);
    if (fixtureRun) return HttpResponse.json(fixtureRun);

    const simulated = state.simulatedRuns.find((run) => run.id === params.id);
    if (!simulated) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That run no longer exists.' } },
        { status: 404 },
      );
    }

    const derived = deriveRunState(simulated);
    if (simulated.cancelledAtMs == null && derived.status !== 'completed') {
      const cancelledAtMs = Date.now();
      simulated.cancelledAtMs = cancelledAtMs;
      simulated.pausedAtMs = null;
      simulated.controlEvents = [
        ...(simulated.controlEvents ?? []),
        {
          id: crypto.randomUUID(),
          runId: simulated.id,
          type: 'run.cancelled',
          message: 'The run was cancelled. Nothing further was searched.',
          data: null,
          createdAt: new Date(cancelledAtMs).toISOString(),
        },
      ];
      persistRuns();
    }
    return HttpResponse.json(buildSimulatedRun(simulated.id, simulated.missionId));
  }),

  /**
   * Pauses a run. The clock stops where it stands — the derived timeline
   * freezes at the pause instant, exactly as the backend stops at its next
   * checkpoint. A finished run is returned unchanged, like the backend's.
   */
  http.post(apiUrl('/runs/:id/pause'), async ({ params }) => {
    const chaos = await applyChaos('/runs');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const fixtureRun = state.runs.find((run) => run.id === params.id);
    if (fixtureRun) return HttpResponse.json(fixtureRun);

    const simulated = state.simulatedRuns.find((run) => run.id === params.id);
    if (!simulated) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That run no longer exists.' } },
        { status: 404 },
      );
    }

    const derived = deriveRunState(simulated);
    if (simulated.pausedAtMs == null && derived.status !== 'completed') {
      const pausedAtMs = Date.now();
      simulated.pausedAtMs = pausedAtMs;
      simulated.controlEvents = [
        ...(simulated.controlEvents ?? []),
        {
          id: crypto.randomUUID(),
          runId: simulated.id,
          type: 'run.paused',
          message: 'The run was paused. It continues from its next checkpoint.',
          data: null,
          createdAt: new Date(pausedAtMs).toISOString(),
        },
      ];
      persistRuns();
    }
    return HttpResponse.json(buildSimulatedRun(simulated.id, simulated.missionId));
  }),

  /**
   * Resumes a paused run: the clock is shifted forward by the paused
   * duration, so the timeline continues from where it stopped instead of
   * jumping ahead.
   */
  http.post(apiUrl('/runs/:id/resume'), async ({ params }) => {
    const chaos = await applyChaos('/runs');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const fixtureRun = state.runs.find((run) => run.id === params.id);
    if (fixtureRun) return HttpResponse.json(fixtureRun);

    const simulated = state.simulatedRuns.find((run) => run.id === params.id);
    if (!simulated) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That run no longer exists.' } },
        { status: 404 },
      );
    }

    if (simulated.pausedAtMs != null) {
      const nowMs = Date.now();
      simulated.startedAtMs += nowMs - simulated.pausedAtMs;
      simulated.pausedAtMs = null;
      simulated.controlEvents = [
        ...(simulated.controlEvents ?? []),
        {
          id: crypto.randomUUID(),
          runId: simulated.id,
          type: 'run.resumed',
          message: 'The run was re-queued to continue from where it paused.',
          data: null,
          createdAt: new Date(nowMs).toISOString(),
        },
      ];
      persistRuns();
    }
    return HttpResponse.json(buildSimulatedRun(simulated.id, simulated.missionId));
  }),

  /**
   * Re-queues a run that failed or stopped short. A simulated run never
   * fails — failures come from the chaos layer at the request level — so
   * this is the backend's state guard: anything but failed or partial is
   * returned unchanged.
   */
  http.post(apiUrl('/runs/:id/retry'), async ({ params }) => {
    const chaos = await applyChaos('/runs');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const fixtureRun = state.runs.find((run) => run.id === params.id);
    if (fixtureRun) return HttpResponse.json(fixtureRun);

    const simulated = state.simulatedRuns.find((run) => run.id === params.id);
    if (!simulated) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That run no longer exists.' } },
        { status: 404 },
      );
    }
    return HttpResponse.json(buildSimulatedRun(simulated.id, simulated.missionId));
  }),
];

/* ------------------------------------------------------------------ */
/* Opportunities                                                       */
/* ------------------------------------------------------------------ */

export const opportunityHandlers = [
  http.get(apiUrl('/opportunities'), async ({ request }) => {
    const chaos = await applyChaos('/opportunities');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const funding = url.searchParams.get('funding');
    const saved = url.searchParams.get('saved');
    const dismissed = url.searchParams.get('dismissed');

    let opportunities = state.opportunities;

    if (type) opportunities = opportunities.filter((item) => item.type === type);
    if (funding) opportunities = opportunities.filter((item) => item.funding.coverage === funding);
    if (saved === 'true') opportunities = opportunities.filter((item) => item.saved);
    if (dismissed === 'true') opportunities = opportunities.filter((item) => item.dismissed);

    return HttpResponse.json({
      opportunities,
      matches: state.matches.filter((match) =>
        opportunities.some((opportunity) => opportunity.id === match.opportunityId),
      ),
      nextCursor: null,
      hasMore: false,
    });
  }),

  http.get(apiUrl('/opportunities/:id'), async ({ params }) => {
    const chaos = await applyChaos('/opportunities');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const opportunity = state.opportunities.find((item) => item.id === params.id);
    if (!opportunity) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That opportunity is no longer available.' } },
        { status: 404 },
      );
    }

    const match = state.matches.find((item) => item.opportunityId === opportunity.id) ?? null;
    const evidence = state.evidence.filter((item) => item.opportunityId === opportunity.id);
    const sourceIds = new Set(evidence.map((item) => item.sourceId));
    const sources = state.sources.filter((item) => sourceIds.has(item.id));
    const application = state.applications.find((item) => item.opportunityId === opportunity.id);

    return HttpResponse.json({
      opportunity,
      match,
      evidence,
      sources,
      applicationId: application?.id ?? null,
    });
  }),

  http.post(apiUrl('/opportunities/:id/save'), async ({ params }) => {
    const chaos = await applyChaos('/opportunities');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const opportunity = state.opportunities.find((item) => item.id === params.id);
    if (!opportunity) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That opportunity is no longer available.' } },
        { status: 404 },
      );
    }
    opportunity.saved = !opportunity.saved;
    return HttpResponse.json(opportunity);
  }),

  http.post(apiUrl('/opportunities/:id/dismiss'), async ({ params, request }) => {
    const chaos = await applyChaos('/opportunities');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const opportunity = state.opportunities.find((item) => item.id === params.id);
    if (!opportunity) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That opportunity is no longer available.' } },
        { status: 404 },
      );
    }

    await request.json().catch(() => ({}));
    opportunity.dismissed = true;
    opportunity.saved = false;
    return HttpResponse.json(opportunity);
  }),

  http.post(apiUrl('/opportunities/:id/applications'), async ({ params }) => {
    const chaos = await applyChaos('/opportunities');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const opportunity = state.opportunities.find((item) => item.id === params.id);
    if (!opportunity) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That opportunity is no longer available.' } },
        { status: 404 },
      );
    }

    const existing = state.applications.find((item) => item.opportunityId === opportunity.id);
    if (existing) return HttpResponse.json(existing);

    const now = new Date().toISOString();
    const application = {
      id: `4e000000-0000-4000-8000-${String(state.applications.length + 1).padStart(12, '0')}`,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      institution: opportunity.institution,
      status: 'considering' as const,
      deadline: opportunity.deadline.value,
      deadlineVerified: opportunity.deadline.status === 'verified',
      checklist: [],
      tasks: [],
      draftIds: [],
      completion: { completed: 0, total: 0 },
      nextBestAction: 'Review the requirements and add your first task.',
      officialUrl: opportunity.canonicalUrl,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };

    state.applications.push(application);
    return HttpResponse.json(application, { status: 201 });
  }),

  /**
   * Analyses a submitted URL or uploaded document without a saved mission.
   */
  http.post(apiUrl('/opportunities/analyze'), async ({ request }) => {
    const chaos = await applyChaos('/analyze');
    if (chaos) return chaos;
    await pause();

    const body = (await request.json()) as { url?: string };
    if (!body.url) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Paste the link to the opportunity you want analysed.',
            field_errors: { url: ['A link is required.'] },
          },
        },
        { status: 422 },
      );
    }

    const state = getState();
    const runId = `2c000000-0000-4000-8000-${String(state.simulatedRuns.length + 50).padStart(12, '0')}`;
    state.simulatedRuns.push({
      id: runId,
      missionId: '1b000000-0000-4000-8000-000000000001',
      startedAtMs: Date.now(),
    });

    return HttpResponse.json({ runId, status: 'queued' }, { status: 202 });
  }),

  /**
   * Compares two to four opportunities side by side.
   *
   * It is a read of what the agent already found: the same eligibility,
   * funding and deadline, with the differences named. It never invents a
   * ranking the evidence does not support, and it says what it cannot
   * settle.
   */
  http.post(apiUrl('/opportunities/compare'), async ({ request }) => {
    const chaos = await applyChaos('/opportunities');
    if (chaos) return chaos;
    await pause();

    const body = (await request.json()) as { opportunityIds?: string[] };
    const ids = body.opportunityIds ?? [];

    if (ids.length < 2) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Pick at least two opportunities to compare.',
            field_errors: { opportunityIds: ['Two or more are needed.'] },
          },
        },
        { status: 422 },
      );
    }

    const state = getState();
    const opportunities = state.opportunities.filter((item) => ids.includes(item.id));

    if (opportunities.length !== ids.length) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'One of those opportunities was not found.' } },
        { status: 404 },
      );
    }

    const rows = opportunities.map((opportunity) => {
      const match = state.matches.find((item) => item.opportunityId === opportunity.id);
      const unresolved = opportunity.requirements.filter(
        (requirement) => requirement.status === 'unresolved',
      );

      return {
        opportunityId: opportunity.id,
        title: opportunity.title,
        institution: opportunity.institution,
        country: opportunity.country.name,
        fitScore: match?.fitScore ?? 0,
        eligibility: match?.eligibility ?? 'unresolved',
        deadline: opportunity.deadline.value,
        deadlineVerified: opportunity.deadline.status === 'verified',
        fundingCoverage: opportunity.funding.coverage,
        estimatedGap: opportunity.funding.estimatedGap?.amount ?? null,
        currency: opportunity.funding.estimatedGap?.currency ?? null,
        unresolvedRequirements: unresolved.map((requirement) => requirement.label),
      };
    });

    const differences: string[] = [];
    const bestFit = [...rows].sort((a, b) => b.fitScore - a.fitScore)[0];
    const deadlines = rows.filter((row) => row.deadlineVerified);
    if (deadlines.length > 1) {
      const earliest = [...deadlines].sort((a, b) =>
        (a.deadline ?? '').localeCompare(b.deadline ?? ''),
      )[0];
      differences.push(`${earliest?.title} closes first, on ${earliest?.deadline}.`);
    }
    const gaps = rows.filter((row) => (row.estimatedGap ?? 0) > 0);
    if (gaps.length > 0) {
      differences.push(
        `${gaps.length} of them leave a cost you would have to cover: ${gaps
          .map((row) => row.title)
          .join(', ')}.`,
      );
    }
    const blocked = rows.filter((row) => row.unresolvedRequirements.length > 0);
    if (blocked.length > 0) {
      differences.push(
        `${blocked.length} of them still have requirements you have not confirmed yet.`,
      );
    }
    if (bestFit) {
      differences.push(
        `${bestFit.title} matches your profile best, at ${bestFit.fitScore} out of 100.`,
      );
    }

    const unverified: string[] = [];
    if (rows.some((row) => row.deadline && !row.deadlineVerified)) {
      unverified.push('At least one deadline has not been confirmed by an official source.');
    }
    if (rows.some((row) => row.eligibility === 'unresolved')) {
      unverified.push('Some eligibility questions are still open, so the comparison is partial.');
    }

    return HttpResponse.json({ rows, differences, unverified });
  }),
];
