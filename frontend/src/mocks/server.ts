import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { persistState, resetState } from './state';
import { clearAllChaosRules } from './chaos';

/** Node-side mock server used by Vitest. */
export const server = setupServer(...handlers);

/**
 * Writes the state back to the store after every change.
 *
 * A read cannot change anything, so only write requests persist. This is
 * what makes a confirmed fact or a started draft survive a refresh.
 */
server.events.on('request:end', ({ request }) => {
  if (request.method !== 'GET') persistState();
});

/** Installs the interceptor for one test file. */
export function startMockServer(): void {
  server.listen({ onUnhandledFrame: 'bypass' });
}

/**
 * Removes the interceptor and clears the mock state.
 *
 * `msw/node` patches the global `fetch`, so the interceptor must be removed
 * when the file finishes — otherwise it would shadow the next file's server
 * and answer with stale state.
 */
export function stopMockServer(): void {
  server.close();
  resetState();
  clearAllChaosRules();
}
