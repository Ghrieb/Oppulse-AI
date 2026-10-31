import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { persistState, signInAsDemo } from './state';
import { clearAllChaosRules, listChaosRules, setChaosRule } from './chaos';

/**
 * Browser mock worker.
 *
 * MSW intercepts at the network layer, so the application code exercises
 * real `fetch` semantics — status codes, headers, JSON bodies, network
 * failures — while the responses come from fixtures.
 */
export const worker = setupWorker(...handlers);

/**
 * Opens the fixture-backed workspace without collecting credentials.
 * This is only called when the build is explicitly configured for mock mode.
 */
export function startGuestWorkspace(): void {
  signInAsDemo();
}

/**
 * Writes the state back to the store after every change.
 *
 * The mock backend has to behave like a server: a confirmed fact, a started
 * draft or a marked alert must still be there after a refresh.
 */
worker.events.on('request:end', ({ request }) => {
  if (request.method !== 'GET') persistState();
});

/**
 * Exposes chaos controls to the dev console and the in-app developer panel.
 * This is a development-only affordance and is never attached in production
 * builds.
 */
export function exposeDevTools(): void {
  if (!import.meta.env.DEV) return;

  Object.defineProperty(window, '__oppulse', {
    configurable: true,
    value: {
      chaos: {
        set: setChaosRule,
        clear: clearAllChaosRules,
        list: listChaosRules,
      },
    },
  });
}
