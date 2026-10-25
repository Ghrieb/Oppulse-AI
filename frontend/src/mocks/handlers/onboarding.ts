import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { applyChaos } from '../chaos';
import { getState, persistOnboardingDraft, persistRuns } from '../state';
import { deriveMissionPreview } from '@/lib/onboarding/engine';
import { recomputeAll } from '@/lib/matching';
import type { Mission } from '@/lib/schemas';
import type { OnboardingDraft } from '@/lib/schemas/onboarding';

/**
 * Onboarding endpoints.
 *
 * These handlers are the executable specification for the FastAPI routes
 * the backend will implement: the paths, the status codes and the error
 * shapes are already fixed.
 */

const EMPTY_DRAFT: OnboardingDraft = {
  id: 'd1000000-0000-4000-8000-000000000001',
  intent: null,
  referenceUrl: null,
  answers: [],
  uploadedDocumentId: null,
  uploadedDocumentStatus: null,
  uploadedDocumentConsent: null,
  currentQuestionId: 'goal',
  completed: false,
  updatedAt: '2026-10-19T08:00:00.000Z',
};

export const onboardingHandlers = [
  http.get(apiUrl('/onboarding/draft'), async () => {
    const chaos = await applyChaos('/onboarding');
    if (chaos) return chaos;
    await delay(40);

    const state = getState();
    return HttpResponse.json({ draft: state.onboardingDraft ?? EMPTY_DRAFT });
  }),

  http.put(apiUrl('/onboarding/draft'), async ({ request }) => {
    const chaos = await applyChaos('/onboarding');
    if (chaos) return chaos;
    await delay(40);

    const draft = (await request.json()) as OnboardingDraft;
    const state = getState();
    state.onboardingDraft = { ...draft, updatedAt: new Date().toISOString() };
    persistOnboardingDraft();

    return HttpResponse.json({ draft: state.onboardingDraft });
  }),

  /**
   * Completes onboarding: derives the mission from the answers, creates it
   * and starts a bounded research run.
   */
  http.post(apiUrl('/onboarding/complete'), async ({ request }) => {
    const chaos = await applyChaos('/onboarding');
    if (chaos) return chaos;
    await delay(80);

    const body = (await request.json()) as { draft?: OnboardingDraft };
    const state = getState();

    if (!body.draft || body.draft.answers.length === 0) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Answer at least one question before starting research.',
            field_errors: { draft: ['The draft is empty.'] },
          },
        },
        { status: 422 },
      );
    }

    const preview = deriveMissionPreview(body.draft, state.profile);
    const now = new Date().toISOString();

    // The date of birth is protected data, so it is written to the
    // protected part of the profile — never to a fact, and never into the
    // mission itself.
    const ageAnswer = body.draft.answers.find((answer) => answer.questionId === 'age');
    if (ageAnswer && typeof ageAnswer.value === 'string') {
      const declined = ageAnswer.value === 'prefer_not_to_say';
      const iso = declined ? null : ageAnswer.value;

      state.protectedProfile = {
        dateOfBirth: {
          value: iso,
          status: declined ? 'declined' : 'provided',
          source: 'onboarding',
          updatedAt: now,
          excludedFromAiContext: state.protectedProfile.dateOfBirth.excludedFromAiContext,
        },
      };

      // The conclusions change with the date, so every opportunity is
      // re-evaluated against it.
      const recomputed = recomputeAll(
        state.opportunities,
        state.matches,
        state.profile,
        state.protectedProfile,
      );
      state.opportunities = recomputed.opportunities;
      state.matches = recomputed.matches;
    }

    const mission: Mission = {
      id: `1b000000-0000-4000-8000-${String(state.missions.length + 1).padStart(12, '0')}`,
      title: preview.title,
      objective: preview.objective,
      criteria: preview.criteria,
      status: 'active',
      source: 'onboarding',
      selectedDocumentIds: body.draft.uploadedDocumentId ? [body.draft.uploadedDocumentId] : [],
      confirmedFactIds: preview.usedFacts
        .map((fact) => state.profile.facts.find((item) => item.key === fact.key)?.id)
        .filter((id): id is string => Boolean(id)),
      limitations: preview.limitations,
      // The student pressed "Run research", which is the confirmation.
      userConfirmedAt: now,
      monitoring: { enabled: true, frequency: 'daily' },
      latestRunId: null,
      createdAt: now,
      updatedAt: now,
    };

    const runId = `2c000000-0000-4000-8000-${String(state.simulatedRuns.length + 90).padStart(12, '0')}`;
    state.simulatedRuns.push({
      id: runId,
      missionId: mission.id,
      startedAtMs: Date.now(),
    });
    persistRuns();

    mission.latestRunId = runId;
    state.missions.unshift(mission);
    state.onboardingDraft = { ...body.draft, completed: true };
    persistOnboardingDraft();

    return HttpResponse.json(
      {
        mission: { id: mission.id, title: mission.title, objective: mission.objective },
        runId,
      },
      { status: 201 },
    );
  }),
];
