import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { IS_MOCK_MODE } from '@/lib/api/config';

/**
 * Capability status.
 *
 * The prototype disclosure evolves from one generic banner into a per-service
 * status, so a reviewer can see exactly which parts are live, which are
 * simulated and which are unavailable. The backend will answer this from
 * the health of each provider.
 */
export const capabilityHandlers = [
  http.get(apiUrl('/capabilities'), async () => {
    await delay(30);

    const mocked = IS_MOCK_MODE;

    return HttpResponse.json({
      isPrototype: mocked,
      capabilities: [
        {
          key: 'data',
          label: 'Profile and opportunities',
          mode: mocked ? ('mocked' as const) : ('live' as const),
          detail: mocked
            ? 'Synthetic fixtures. Every name, programme and source below is invented.'
            : 'Your own profile, opportunities and evidence.',
        },
        {
          key: 'ai',
          label: 'AI reasoning',
          mode: mocked ? ('mocked' as const) : ('live' as const),
          detail: mocked
            ? 'The agent’s analysis is pre-written for the demo, not generated.'
            : 'The agent interprets your goal, extracts requirements and explains its reasoning.',
        },
        {
          key: 'search',
          label: 'Web research',
          mode: mocked ? ('mocked' as const) : ('live' as const),
          detail: mocked
            ? 'Search results are recorded fixtures, not live queries.'
            : 'Live search across official pages and directories.',
        },
        {
          key: 'extraction',
          label: 'Document understanding',
          mode: mocked ? ('mocked' as const) : ('live' as const),
          detail: mocked
            ? 'Facts are pre-loaded for the demo. Real extraction runs on the server.'
            : 'PDFs and Word documents are read and turned into facts you confirm.',
        },
        {
          key: 'monitoring',
          label: 'Change monitoring',
          mode: mocked ? ('mocked' as const) : ('live' as const),
          detail: mocked
            ? 'A recorded check and a labelled test event stand in for the worker.'
            : 'A scheduled worker re-checks your saved sources and alerts you.',
        },
        {
          key: 'in_app',
          label: 'In-app alerts',
          // In-app delivery needs no provider, so it works in every mode.
          mode: 'live',
          detail: 'Alerts always appear in the product, whether or not email is set up.',
        },
        {
          key: 'email',
          label: 'Email notifications',
          // A later increment. A schema existing is not a capability.
          mode: 'unavailable',
          detail: 'Not connected yet, and not part of the first student-testing release.',
        },
      ],
    });
  }),
];
