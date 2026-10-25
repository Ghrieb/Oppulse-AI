import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { applyChaos } from '../chaos';
import { getState } from '../state';
import { buildImpact, recomputeAll } from '@/lib/matching';
import { deterministicUuid } from '@/lib/ids';
import type { FactRevisionAction, ProfileFactRevision } from '@/lib/schemas';

/**
 * The profile.
 *
 * A fact mutation is not just a write: it changes what the agent can
 * conclude, so the mock re-evaluates every opportunity against the updated
 * profile. The backend will do exactly the same thing with the same rule
 * set from `lib/matching.ts`.
 */
export const profileHandlers = [
  http.get(apiUrl('/profile'), async () => {
    const chaos = await applyChaos('/profile');
    if (chaos) return chaos;
    await delay(40);
    return HttpResponse.json(getState().profile);
  }),

  http.patch(apiUrl('/profile'), async ({ request }) => {
    const chaos = await applyChaos('/profile');
    if (chaos) return chaos;
    await delay(40);

    const body = (await request.json()) as {
      fullName?: string;
      preferences?: Record<string, unknown>;
      consent?: Record<string, unknown>;
    };
    const state = getState();

    // The email preferences are nested, so a shallow merge would drop the
    // categories the student did not touch.
    const preferences = body.preferences
      ? {
          ...state.profile.preferences,
          ...body.preferences,
          email: {
            ...state.profile.preferences.email,
            ...((body.preferences.email as Record<string, unknown> | undefined) ?? {}),
            categories: {
              ...state.profile.preferences.email.categories,
              ...(((body.preferences.email as Record<string, unknown> | undefined)?.categories as
                Record<string, unknown> | undefined) ?? {}),
            },
          },
        }
      : state.profile.preferences;

    state.profile = {
      ...state.profile,
      fullName: body.fullName ?? state.profile.fullName,
      preferences,
      consent: { ...state.profile.consent, ...(body.consent ?? {}) },
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(state.profile);
  }),

  http.get(apiUrl('/profile/protected'), async () => {
    const chaos = await applyChaos('/profile');
    if (chaos) return chaos;
    await delay(40);
    return HttpResponse.json({ protectedProfile: getState().protectedProfile });
  }),

  /**
   * Changes the protected part of the profile.
   *
   * The date of birth is the only thing here, and it is used for one
   * purpose: checking an age requirement. When it changes, every
   * opportunity is re-evaluated, because the conclusions change with it.
   */
  http.patch(apiUrl('/profile/protected'), async ({ request }) => {
    const chaos = await applyChaos('/profile');
    if (chaos) return chaos;
    await delay(40);

    const body = (await request.json()) as {
      dateOfBirth?: string | null;
      dateOfBirthStatus?: 'not_provided' | 'provided' | 'declined' | 'excluded';
      excludedFromAiContext?: boolean;
      source?: string | null;
    };
    const state = getState();
    const now = new Date().toISOString();

    const nextValue = body.dateOfBirth !== undefined ? body.dateOfBirth : undefined;

    if (nextValue !== undefined && nextValue !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextValue)) {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION',
              message: 'Enter a date as YYYY-MM-DD.',
              field_errors: { dateOfBirth: ['Use the format YYYY-MM-DD.'] },
            },
          },
          { status: 422 },
        );
      }

      const parsed = new Date(`${nextValue}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION',
              message: 'That date cannot be right.',
              field_errors: { dateOfBirth: ['Enter a real date that is not in the future.'] },
            },
          },
          { status: 422 },
        );
      }
    }

    const status =
      body.dateOfBirthStatus ??
      (nextValue === undefined
        ? state.protectedProfile.dateOfBirth.status
        : nextValue === null
          ? 'declined'
          : 'provided');

    state.protectedProfile = {
      dateOfBirth: {
        value: nextValue === undefined ? state.protectedProfile.dateOfBirth.value : nextValue,
        status,
        source: body.source !== undefined ? body.source : state.protectedProfile.dateOfBirth.source,
        updatedAt: nextValue === undefined ? state.protectedProfile.dateOfBirth.updatedAt : now,
        excludedFromAiContext:
          body.excludedFromAiContext ?? state.protectedProfile.dateOfBirth.excludedFromAiContext,
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

    return HttpResponse.json({ protectedProfile: state.protectedProfile });
  }),

  /**
   * Changes one fact: confirm it, correct its value, or exclude it from
   * the AI's context.
   */
  http.patch(apiUrl('/profile/facts/:id'), async ({ params, request }) => {
    const chaos = await applyChaos('/profile');
    if (chaos) return chaos;
    await delay(40);

    const state = getState();
    const fact = state.profile.facts.find((item) => item.id === params.id);

    if (!fact) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That fact no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      status?: 'confirmed' | 'rejected';
      value?: string;
      excluded?: boolean;
    };

    const previousValue = fact.value;
    let action: FactRevisionAction | null = null;

    if (body.value !== undefined && body.value !== fact.value) {
      fact.value = body.value;
      fact.corrected = true;
      action = 'corrected';
    }

    if (body.status && body.status !== fact.status) {
      fact.status = body.status;
      action = body.status === 'confirmed' ? 'confirmed' : 'rejected';
    }

    if (body.excluded !== undefined && body.excluded !== fact.excluded) {
      fact.excluded = body.excluded;
      action = body.excluded ? 'excluded' : 'restored';
    }

    if (action) {
      fact.updatedAt = new Date().toISOString();
      state.profile.updatedAt = fact.updatedAt;

      const revision: ProfileFactRevision = {
        id: deterministicUuid(`revision:${fact.id}:${state.revisions.length}`),
        factId: fact.id,
        factLabel: fact.label,
        action,
        previousValue,
        newValue: fact.value,
        sourceDocumentName: fact.source?.documentName ?? null,
        createdAt: fact.updatedAt,
      };
      state.revisions.unshift(revision);

      // The agent's conclusions change with the profile.
      const recomputed = recomputeAll(
        state.opportunities,
        state.matches,
        state.profile,
        state.protectedProfile,
      );
      state.opportunities = recomputed.opportunities;
      state.matches = recomputed.matches;
    }

    return HttpResponse.json({
      fact,
      revisions: state.revisions,
      impact: buildImpact(state.opportunities),
    });
  }),

  /** The review history: every change, newest first. */
  http.get(apiUrl('/profile/revisions'), async () => {
    const chaos = await applyChaos('/profile');
    if (chaos) return chaos;
    await delay(30);
    return HttpResponse.json({ revisions: getState().revisions });
  }),

  /** What each fact is holding up. */
  http.get(apiUrl('/profile/impact'), async () => {
    const chaos = await applyChaos('/profile');
    if (chaos) return chaos;
    await delay(30);
    return HttpResponse.json({ impact: buildImpact(getState().opportunities) });
  }),

  http.get(apiUrl('/profile/snapshots/latest'), async () => {
    await delay(30);
    const { DEMO_PROFILE_SNAPSHOT } = await import('../fixtures');
    return HttpResponse.json(DEMO_PROFILE_SNAPSHOT);
  }),
];
