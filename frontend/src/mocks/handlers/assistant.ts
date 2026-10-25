import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { applyChaos } from '../chaos';
import { getState } from '../state';
import { buildDraftContent } from '../draft-templates';
import { deterministicUuid } from '@/lib/ids';
import type { AssistantBlock, AssistantContext, Draft, DraftType, Evidence } from '@/lib/schemas';

/**
 * The assistant.
 *
 * The mock is context-aware, exactly as the backend will be: what the
 * agent answers depends on what the student is looking at. That is the
 * difference between a paragraph generator and an agent.
 */

function evidenceBlockFor(opportunityId: string): AssistantBlock | null {
  const state = getState();
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return null;

  const requirement =
    opportunity.requirements.find((item) => item.status === 'unresolved') ??
    opportunity.requirements[0];
  if (!requirement) return null;

  // A requirement points at evidence records; each evidence record points at
  // the source it was taken from. The answer cites the source.
  const sources = requirement.evidenceIds
    .map((evidenceId) => state.evidence.find((item) => item.id === evidenceId))
    .filter((item): item is Evidence => Boolean(item))
    .map((evidence) => {
      const source = state.sources.find((item) => item.id === evidence.sourceId);

      return {
        title: source?.title ?? evidence.claim,
        url: source?.url ?? evidence.url,
        quote: evidence.excerpt,
        quality: evidence.quality,
      };
    });

  return {
    kind: 'evidence',
    title: requirement.label,
    summary: requirement.explanation,
    sources,
    requirementId: requirement.id,
  };
}

function checklistBlockFor(opportunityId: string): AssistantBlock | null {
  const state = getState();
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return null;

  return {
    kind: 'checklist',
    title: `What ${opportunity.title} requires`,
    items: opportunity.requirements.map((requirement) => ({
      label: requirement.label,
      status:
        requirement.status === 'likely'
          ? ('ready' as const)
          : requirement.status === 'unresolved'
            ? ('needs_attention' as const)
            : requirement.status === 'ineligible'
              ? ('missing' as const)
              : ('done' as const),
      detail: requirement.explanation,
      route:
        requirement.profileFactKey && requirement.status === 'unresolved'
          ? `/profile?fact=${requirement.profileFactKey}`
          : null,
    })),
  };
}

function applicationChecklistBlock(applicationId: string): AssistantBlock | null {
  const state = getState();
  const application = state.applications.find((item) => item.id === applicationId);
  if (!application) return null;

  return {
    kind: 'checklist',
    title: `Still to do for ${application.opportunityTitle}`,
    items: application.checklist.map((item) => ({
      label: item.label,
      status:
        item.status === 'done'
          ? ('done' as const)
          : item.status === 'ready'
            ? ('ready' as const)
            : item.status === 'needs_attention'
              ? ('needs_attention' as const)
              : ('missing' as const),
      detail: item.note ?? item.source,
      route: item.documentId ? '/documents' : null,
    })),
  };
}

function draftActionBlock(
  draftType: DraftType,
  applicationId: string | null,
  description: string,
): AssistantBlock {
  return {
    kind: 'draft_action',
    title: `Start your ${draftType.replace(/_/g, ' ')}`,
    description,
    draftType,
    applicationId,
    effect: 'prepares',
  };
}

/**
 * A reference to an opportunity.
 *
 * The message does not repeat the opportunity; it points at it, so the
 * detail panel can open it.
 */
function opportunityReferenceBlock(opportunityId: string | undefined): AssistantBlock | null {
  if (!opportunityId) return null;

  const opportunity = getState().opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return null;

  return {
    kind: 'opportunity_reference',
    opportunityId: opportunity.id,
    title: opportunity.title,
    institution: opportunity.institution,
    country: opportunity.country.name,
    reason: 'This is the call the answer is based on. Open it for the full evidence.',
  };
}

/**
 * What the official source says about the institution.
 *
 * It separates what was stated from what could not be verified, and the
 * media it carries is labelled as secondary.
 */
function institutionBlock(opportunityId: string | undefined): AssistantBlock | null {
  if (!opportunityId) return null;

  const opportunity = getState().opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return null;

  const evidence = getState()
    .sources.filter((source) => source.domain === opportunity.sourceDomain)
    .slice(0, 2)
    .map((source) => ({
      title: source.title,
      url: source.url,
      quote: source.excerpt.slice(0, 220),
      sourceType: source.quality === 'official' ? ('official' as const) : ('secondary' as const),
    }));

  return {
    kind: 'institution',
    description: `${opportunity.institution} runs ${opportunity.title.replace(opportunity.institution, '').trim() || 'this programme'}.`,
    location: opportunity.institution,
    country: opportunity.country.name,
    institutionType: null,
    programmeContext: opportunity.summary,
    evidence,
    media: [],
    unverified: [
      'How competitive the programme is — no source states it, and Oppulse will not estimate it.',
    ],
    action: 'Check your eligibility against the requirements below.',
  };
}

/**
 * Media, as secondary context.
 *
 * It is never used for eligibility, funding or a deadline.
 */
function mediaContextBlock(opportunityId: string | undefined): AssistantBlock | null {
  if (!opportunityId) return null;

  const opportunity = getState().opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) return null;

  return {
    kind: 'media_context',
    subject: `What the official page for ${opportunity.title} shows`,
    media: [
      {
        kind: 'image',
        url: `https://${opportunity.sourceDomain}/media/campus`,
        title: `${opportunity.institution} — campus`,
        publisher: opportunity.institution,
        publishedAt: null,
        sourceType: 'official',
        attribution: `From ${opportunity.sourceDomain}`,
        summary: null,
        status: 'available',
      },
      {
        kind: 'video',
        url: `https://www.youtube.com/watch?v=demo-${opportunity.id.slice(-4)}`,
        title: `${opportunity.institution} — introduction`,
        publisher: opportunity.institution,
        publishedAt: null,
        sourceType: 'official',
        attribution: null,
        summary: 'A short introduction. It does not establish eligibility or funding.',
        status: 'not_reviewed',
      },
      {
        kind: 'image',
        url: `https://${opportunity.sourceDomain}/media/prospectus`,
        title: `${opportunity.institution} — prospectus`,
        publisher: opportunity.institution,
        publishedAt: null,
        sourceType: 'official',
        attribution: null,
        summary: null,
        status: 'unavailable',
      },
      {
        kind: 'video',
        url: `https://www.youtube.com/watch?v=removed-${opportunity.id.slice(-4)}`,
        title: `${opportunity.institution} — campus tour`,
        publisher: opportunity.institution,
        publishedAt: null,
        sourceType: 'official',
        attribution: null,
        summary: null,
        status: 'removed',
      },
    ],
  };
}

/**
 * What could not be verified.
 *
 * The honest edge of the answer: what was checked, what remains unknown,
 * and the most useful next step.
 */
function unknownOrConflictBlock(conflict: boolean): AssistantBlock {
  return {
    kind: 'unknown_or_conflict',
    question: conflict
      ? 'Two sources give different closing dates for this call, so the application window is not yet known.'
      : 'Oppulse has not yet reached the official page for this call, so its deadline and funding are unknown rather than absent.',
    checked: [
      'The official programme page',
      'The directory listing for the same call',
      'Your confirmed profile',
    ],
    nextAction: conflict
      ? 'Open the call and check the date before you plan around it.'
      : 'Open the source yourself, or ask Oppulse to try it again.',
    conflict,
  };
}

export const assistantHandlers = [
  /** The conversation. In Phase A the device copy wins; this is the Phase B source. */
  http.get(apiUrl('/assistant/history'), async () => {
    await delay(30);
    return HttpResponse.json({ messages: [] });
  }),

  http.post(apiUrl('/assistant/messages'), async ({ request }) => {
    const chaos = await applyChaos('/assistant');
    if (chaos) return chaos;
    await delay(650);

    const body = (await request.json()) as {
      message?: string;
      context?: AssistantContext;
      selectedText?: string;
    };
    const state = getState();
    const context = body.context ?? {};
    const message = body.message ?? '';

    // A pasted link starts a research run.
    if (/https?:\/\//i.test(message)) {
      const runId = `2c000000-0000-4000-8000-${String(state.simulatedRuns.length + 120).padStart(12, '0')}`;
      state.simulatedRuns.push({
        id: runId,
        missionId: '1b000000-0000-4000-8000-000000000001',
        startedAtMs: Date.now(),
      });

      return HttpResponse.json({
        blocks: [
          {
            kind: 'run' as const,
            runId,
            status: 'queued',
            message: 'I started a research run on that link. I will report what I could verify.',
          },
        ],
        suggestions: ['What could you not reach?', 'Show me the funding detail'],
        context,
      });
    }

    const blocks: AssistantBlock[] = [];

    if (context.applicationId) {
      const checklist = applicationChecklistBlock(context.applicationId);
      if (checklist) blocks.push(checklist);
      const reference = opportunityReferenceBlock(context.opportunityId);
      if (reference) blocks.push(reference);
      const institution = institutionBlock(context.opportunityId);
      if (institution) blocks.push(institution);
      blocks.push(unknownOrConflictBlock(false));
      blocks.push(
        draftActionBlock(
          'motivation_letter',
          context.applicationId,
          'Oppulse will draft from your confirmed facts and show you every change before it touches your document.',
        ),
      );
    } else if (context.opportunityId) {
      const evidence = evidenceBlockFor(context.opportunityId);
      if (evidence) blocks.push(evidence);
      const checklist = checklistBlockFor(context.opportunityId);
      if (checklist) blocks.push(checklist);
      const reference = opportunityReferenceBlock(context.opportunityId);
      if (reference) blocks.push(reference);
      const institution = institutionBlock(context.opportunityId);
      if (institution) blocks.push(institution);
      const media = mediaContextBlock(context.opportunityId);
      if (media) blocks.push(media);
      blocks.push(unknownOrConflictBlock(true));
      blocks.push(
        draftActionBlock(
          'motivation_letter',
          null,
          'Oppulse will draft from your confirmed facts and show you every change before it touches your document.',
        ),
      );
    } else if (context.draftId) {
      const draft = state.drafts.find((item) => item.id === context.draftId);
      blocks.push({
        kind: 'text',
        text: draft
          ? `I am looking at ${draft.title}, version ${draft.currentVersion}. Tell me what to change and I will propose a revision — you approve it before anything is applied.`
          : 'I am looking at your draft. Tell me what to change and I will propose a revision.',
      });
    } else {
      blocks.push({
        kind: 'text',
        text: 'I can work from your confirmed profile, the sources the agent has retrieved, and the application you are working on. Pick one of those below, or ask me directly.',
      });
      blocks.push(unknownOrConflictBlock(false));
    }

    const suggestions = context.opportunityId
      ? ['Compare the funding', 'What is still unresolved?', 'Track this opportunity']
      : context.applicationId
        ? ['Which documents am I missing?', 'Draft a request to my referee']
        : ['Find fully funded opportunities for me', 'Analyse a link'];

    return HttpResponse.json({ blocks, suggestions, context });
  }),

  /**
   * Runs an action the assistant offered. Everything that creates state is
   * confirmed by the user before it reaches this endpoint.
   */
  http.post(apiUrl('/assistant/actions'), async ({ request }) => {
    const chaos = await applyChaos('/assistant');
    if (chaos) return chaos;
    await delay(420);

    const body = (await request.json()) as {
      action?: 'create_draft' | 'create_checklist' | 'start_run' | 'open_route';
      context?: AssistantContext;
      payload?: Record<string, unknown>;
    };
    const state = getState();
    const action = body.action ?? 'open_route';
    const context = body.context ?? {};

    if (action === 'create_draft') {
      const draftType = (body.payload?.draftType as DraftType | undefined) ?? 'motivation_letter';

      const application = context.applicationId
        ? state.applications.find((item) => item.id === context.applicationId)
        : state.applications.find((item) => item.opportunityId === context.opportunityId);

      if (!application) {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message:
                'Add this opportunity to your application workspace first, then I can draft for it.',
            },
          },
          { status: 409 },
        );
      }

      const opportunity = state.opportunities.find((item) => item.id === application.opportunityId);

      const draft: Draft = {
        id: `60000000-0000-4000-8000-${String(state.drafts.length + 1).padStart(12, '0')}`,
        applicationId: application.id,
        opportunityId: application.opportunityId,
        type: draftType,
        title: `${draftType.replace(/_/g, ' ')} — ${application.opportunityTitle}`,
        currentVersion: 1,
        content: buildDraftContent(draftType, {
          profile: state.profile,
          opportunity: opportunity ?? null,
        }),
        versions: [
          {
            version: 1,
            content: buildDraftContent(draftType, {
              profile: state.profile,
              opportunity: opportunity ?? null,
            }),
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

      return HttpResponse.json({
        block: {
          kind: 'draft_action' as const,
          title: 'Your draft is ready',
          description:
            'It is a starting point grounded in your confirmed facts. Review it, edit it, and export it yourself.',
          draftType,
          applicationId: application.id,
          effect: 'prepares' as const,
        },
        route: `/writing/${draft.id}`,
        createdId: draft.id,
      });
    }

    if (action === 'create_checklist') {
      const opportunity = state.opportunities.find((item) => item.id === context.opportunityId);

      if (!opportunity) {
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'I could not find that opportunity to build a checklist from.',
            },
          },
          { status: 404 },
        );
      }

      const existing = state.applications.find((item) => item.opportunityId === opportunity.id);
      if (existing) {
        return HttpResponse.json({
          block: checklistBlockFor(opportunity.id)!,
          route: `/applications/${existing.id}`,
          createdId: existing.id,
        });
      }

      const now = new Date().toISOString();
      const application = {
        id: `4e000000-0000-4000-8000-${String(state.applications.length + 1).padStart(12, '0')}`,
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        institution: opportunity.institution,
        status: 'considering' as const,
        deadline: opportunity.deadline.value,
        deadlineVerified: opportunity.deadline.status === 'verified',
        checklist: opportunity.requirements.map((requirement) => ({
          id: deterministicUuid(`checklist:${requirement.id}`),
          label: requirement.label,
          status:
            requirement.status === 'likely'
              ? ('ready' as const)
              : requirement.status === 'unresolved'
                ? ('needs_attention' as const)
                : requirement.status === 'ineligible'
                  ? ('missing' as const)
                  : ('done' as const),
          source: requirement.sourceClause,
          dueDate: null,
          documentId: null,
          note: requirement.explanation,
        })),
        tasks: [],
        draftIds: [],
        completion: {
          completed: opportunity.requirements.filter((item) => item.status === 'likely').length,
          total: opportunity.requirements.length,
        },
        nextBestAction: 'Confirm the requirements you still cannot meet.',
        officialUrl: opportunity.canonicalUrl,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };

      state.applications.push(application);

      return HttpResponse.json({
        block: checklistBlockFor(opportunity.id)!,
        route: `/applications/${application.id}`,
        createdId: application.id,
      });
    }

    if (action === 'start_run') {
      const missionId = '1b000000-0000-4000-8000-000000000001';
      const runId = `2c000000-0000-4000-8000-${String(state.simulatedRuns.length + 140).padStart(12, '0')}`;
      state.simulatedRuns.push({ id: runId, missionId, startedAtMs: Date.now() });

      return HttpResponse.json({
        block: {
          kind: 'run' as const,
          runId,
          status: 'queued',
          message: 'Research started. I will report what I found and what I could not reach.',
        },
        route: '/goals',
        createdId: runId,
      });
    }

    const route = (body.payload?.route as string | undefined) ?? '/home';
    return HttpResponse.json({
      block: { kind: 'text' as const, text: 'Here is where you can continue.' },
      route,
      createdId: null,
    });
  }),
];
