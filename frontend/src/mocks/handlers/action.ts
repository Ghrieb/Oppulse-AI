import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { applyChaos } from '../chaos';
import { getState } from '../state';
import { buildDraftContent } from '../draft-templates';
import { reviseSelection } from '../revise-selection';
import type { Draft, DraftType } from '@/lib/schemas';

async function pause(): Promise<void> {
  await delay(45);
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export const applicationHandlers = [
  http.get(apiUrl('/applications'), async () => {
    const chaos = await applyChaos('/applications');
    if (chaos) return chaos;
    await pause();
    return HttpResponse.json({ applications: getState().applications });
  }),

  http.get(apiUrl('/applications/:id'), async ({ params }) => {
    const chaos = await applyChaos('/applications');
    if (chaos) return chaos;
    await pause();

    const application = getState().applications.find((item) => item.id === params.id);
    if (!application) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That application no longer exists.' } },
        { status: 404 },
      );
    }
    return HttpResponse.json(application);
  }),

  http.patch(apiUrl('/applications/:id'), async ({ params, request }) => {
    const chaos = await applyChaos('/applications');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const application = state.applications.find((item) => item.id === params.id);
    if (!application) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That application no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(application, body, { updatedAt: new Date().toISOString() });

    const total = application.checklist.length;
    const completed = application.checklist.filter((item) => item.status === 'done').length;
    application.completion = { completed, total };

    return HttpResponse.json(application);
  }),
];

/* ------------------------------------------------------------------ */
/* Drafts and writing studio                                           */
/* ------------------------------------------------------------------ */

export const draftHandlers = [
  http.get(apiUrl('/drafts/:id'), async ({ params }) => {
    const chaos = await applyChaos('/drafts');
    if (chaos) return chaos;
    await pause();

    const draft = getState().drafts.find((item) => item.id === params.id);
    if (!draft) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That draft no longer exists.' } },
        { status: 404 },
      );
    }
    return HttpResponse.json(draft);
  }),

  http.patch(apiUrl('/drafts/:id'), async ({ params, request }) => {
    const chaos = await applyChaos('/drafts');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const draft = state.drafts.find((item) => item.id === params.id);
    if (!draft) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That draft no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { content?: string; baseVersion?: number };

    // Optimistic concurrency: refuse a write based on a stale version.
    if (body.baseVersion !== undefined && body.baseVersion !== draft.currentVersion) {
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message:
              'This draft changed in another tab or by an accepted revision. Reload to see the latest version before saving.',
          },
        },
        { status: 409 },
      );
    }

    if (body.content !== undefined) {
      draft.content = body.content;
      draft.updatedAt = new Date().toISOString();
    }

    return HttpResponse.json(draft);
  }),

  http.get(apiUrl('/drafts/:id/versions'), async ({ params }) => {
    const chaos = await applyChaos('/drafts');
    if (chaos) return chaos;
    await pause();

    const draft = getState().drafts.find((item) => item.id === params.id);
    if (!draft) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That draft no longer exists.' } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ versions: draft.versions });
  }),

  /**
   * Requests a non-destructive AI revision proposal. The draft is not
   * modified — the proposal is returned for review.
   */
  http.post(apiUrl('/drafts/:id/proposals'), async ({ params, request }) => {
    const chaos = await applyChaos('/proposals');
    if (chaos) return chaos;
    await delay(700);

    const state = getState();
    const draft = state.drafts.find((item) => item.id === params.id);
    if (!draft) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That draft no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { instruction?: string; selectedText?: string };
    if (!body.instruction || body.instruction.trim().length === 0) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Tell the assistant what to change.',
            field_errors: { instruction: ['Describe the change you want.'] },
          },
        },
        { status: 422 },
      );
    }

    const opportunity = state.opportunities.find((item) => item.id === draft.opportunityId) ?? null;
    const instruction = body.instruction.trim();
    const selectedText = body.selectedText?.trim();

    // A selection-aware proposal rewrites *only* the selected range. The
    // rest of the document is untouched, which is what makes it safe to
    // accept.
    const revised = selectedText
      ? reviseSelection(draft.content, selectedText, instruction, opportunity, state.profile)
      : null;

    const proposal = {
      id: `70000000-0000-4000-8000-${String(state.drafts.length + 1).padStart(12, '0')}`,
      draftId: draft.id,
      baseVersion: draft.currentVersion,
      content: revised ?? draft.content,
      summary: selectedText
        ? `Proposed revision for your selection: ${instruction}`
        : `Proposed revision: ${instruction}`,
      unsupportedClaims: selectedText
        ? []
        : [
            'The revision adds a sentence about your research interest. Check it matches what you actually want to say.',
          ],
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    draft.pendingProposal = proposal;
    return HttpResponse.json(proposal, { status: 201 });
  }),

  http.post(apiUrl('/drafts/:id/proposals/:proposalId/accept'), async ({ params }) => {
    const chaos = await applyChaos('/proposals');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const draft = state.drafts.find((item) => item.id === params.id);
    if (!draft || !draft.pendingProposal || draft.pendingProposal.id !== params.proposalId) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That proposal is no longer available.' } },
        { status: 404 },
      );
    }

    const proposal = draft.pendingProposal;
    const nextVersion = draft.currentVersion + 1;

    draft.versions.push({
      version: nextVersion,
      content: proposal.content,
      createdAt: new Date().toISOString(),
      source: 'ai_accepted',
      summary: proposal.summary,
    });
    draft.currentVersion = nextVersion;
    draft.content = proposal.content;
    draft.pendingProposal = null;
    draft.updatedAt = new Date().toISOString();

    return HttpResponse.json(draft);
  }),

  http.post(apiUrl('/drafts/:id/proposals/:proposalId/reject'), async ({ params }) => {
    const chaos = await applyChaos('/proposals');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const draft = state.drafts.find((item) => item.id === params.id);
    if (!draft || !draft.pendingProposal || draft.pendingProposal.id !== params.proposalId) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That proposal is no longer available.' } },
        { status: 404 },
      );
    }

    draft.pendingProposal = null;
    return HttpResponse.json(draft);
  }),
];

/* ------------------------------------------------------------------ */
/* Monitoring and alerts                                               */
/* ------------------------------------------------------------------ */

export const monitoringHandlers = [
  http.get(apiUrl('/monitor-targets'), async () => {
    const chaos = await applyChaos('/monitor');
    if (chaos) return chaos;
    await pause();
    return HttpResponse.json({ targets: getState().monitorTargets });
  }),

  http.post(apiUrl('/monitor-targets'), async ({ request }) => {
    const chaos = await applyChaos('/monitor');
    if (chaos) return chaos;
    await pause();

    const body = (await request.json()) as {
      targetType?: 'mission' | 'opportunity' | 'url';
      targetId?: string;
      url?: string;
      label?: string;
      frequency?: 'hourly' | 'daily' | 'weekly';
    };

    if (!body.label || !body.targetType) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'A name and a target are required.',
            field_errors: {
              label: !body.label ? ['Name this monitoring target.'] : [],
              targetType: !body.targetType ? ['Choose what to monitor.'] : [],
            },
          },
        },
        { status: 422 },
      );
    }

    const state = getState();
    const target = {
      id: `80000000-0000-4000-8000-${String(state.monitorTargets.length + 1).padStart(12, '0')}`,
      targetType: body.targetType,
      targetId: body.targetId ?? null,
      label: body.label,
      url: body.url ?? null,
      frequency: body.frequency ?? 'daily',
      status: 'active' as const,
      lastSuccessfulCheckAt: null,
      nextScheduledCheckAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      eventsDetected: 0,
      sourceUnreachable: false,
    };

    state.monitorTargets.push(target);
    return HttpResponse.json(target, { status: 201 });
  }),

  http.patch(apiUrl('/monitor-targets/:id'), async ({ params, request }) => {
    const chaos = await applyChaos('/monitor');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const target = state.monitorTargets.find((item) => item.id === params.id);
    if (!target) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That monitoring target no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { status?: 'active' | 'paused'; frequency?: string };
    if (body.status) target.status = body.status;
    if (body.frequency) target.frequency = body.frequency as typeof target.frequency;
    return HttpResponse.json(target);
  }),

  http.get(apiUrl('/monitor-events'), async () => {
    const chaos = await applyChaos('/monitor');
    if (chaos) return chaos;
    await pause();
    return HttpResponse.json({ events: getState().monitorEvents });
  }),

  http.get(apiUrl('/alerts'), async () => {
    const chaos = await applyChaos('/alerts');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    return HttpResponse.json({
      alerts: state.alerts,
      unreadCount: state.alerts.filter((alert) => !alert.read).length,
    });
  }),

  http.post(apiUrl('/alerts/:id/read'), async ({ params }) => {
    const chaos = await applyChaos('/alerts');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const alert = state.alerts.find((item) => item.id === params.id);
    if (!alert) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That alert no longer exists.' } },
        { status: 404 },
      );
    }
    alert.read = true;
    return HttpResponse.json(alert);
  }),

  /**
   * Retries a delivery that failed.
   *
   * The only active channel is in-app, and an in-app alert cannot fail its
   * own delivery. Email is a future adapter, so this endpoint exists in the
   * contract and says so, rather than pretending to have sent something.
   */
  http.post(apiUrl('/alerts/:id/retry'), async ({ params }) => {
    const chaos = await applyChaos('/alerts');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const alert = state.alerts.find((item) => item.id === params.id);
    if (!alert) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That alert no longer exists.' } },
        { status: 404 },
      );
    }

    return HttpResponse.json(
      {
        error: {
          code: 'CONFLICT',
          message:
            'There is no other delivery channel yet. The alert is in the app, and it stays there.',
        },
      },
      { status: 409 },
    );
  }),

  /** The drafts belonging to an application. */
  http.get(apiUrl('/applications/:id/drafts'), async ({ params }) => {
    const chaos = await applyChaos('/drafts');
    if (chaos) return chaos;
    await delay(60);

    const drafts = getState().drafts.filter((draft) => draft.applicationId === params.id);
    return HttpResponse.json({ drafts });
  }),

  /**
   * Starts a new document on an application.
   *
   * The template is grounded in the confirmed facts, and the draft is
   * explicitly a starting point the student edits.
   */
  http.post(apiUrl('/applications/:id/drafts'), async ({ params, request }) => {
    const chaos = await applyChaos('/drafts');
    if (chaos) return chaos;
    await delay(320);

    const state = getState();
    const application = state.applications.find((item) => item.id === params.id);
    if (!application) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That application no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { type?: DraftType };
    const draftType = body.type ?? 'motivation_letter';
    const opportunity =
      state.opportunities.find((item) => item.id === application.opportunityId) ?? null;

    const content = buildDraftContent(draftType, { profile: state.profile, opportunity });

    const draft: Draft = {
      id: `60000000-0000-4000-8000-${String(state.drafts.length + 1).padStart(12, '0')}`,
      applicationId: application.id,
      opportunityId: application.opportunityId,
      type: draftType,
      title: `${draftType.replace(/_/g, ' ')} — ${application.opportunityTitle}`,
      currentVersion: 1,
      content,
      versions: [
        {
          version: 1,
          content,
          createdAt: new Date().toISOString(),
          source: 'created',
          summary: 'Starting point, grounded in your confirmed facts. Edit it before you send.',
        },
      ],
      pendingProposal: null,
      updatedAt: new Date().toISOString(),
    };

    state.drafts.push(draft);
    application.draftIds = [...application.draftIds, draft.id];
    application.updatedAt = new Date().toISOString();

    return HttpResponse.json(draft, { status: 201 });
  }),
];
