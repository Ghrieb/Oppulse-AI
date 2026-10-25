import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { applyChaos } from '../chaos';
import { getState } from '../state';
import { deriveNextAction } from '@/lib/next-action';

/**
 * The next best action.
 *
 * The derivation lives in `lib/next-action.ts` as a pure function, so the
 * mock, the client and the backend all reach the same answer rather than
 * three copies of the same rule drifting apart.
 */
export const nextActionHandlers = [
  http.get(apiUrl('/next-action'), async () => {
    const chaos = await applyChaos('/next-action');
    if (chaos) return chaos;
    await delay(30);

    const state = getState();

    const action = deriveNextAction({
      profile: state.profile,
      opportunities: state.opportunities,
      applications: state.applications,
      drafts: state.drafts,
      sources: state.sources,
      alerts: state.alerts,
      now: new Date().toISOString(),
    });

    return HttpResponse.json({ action });
  }),
];
