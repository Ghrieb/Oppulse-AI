import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
import { startMockServer, stopMockServer, server } from '@/mocks/server';
import { resetState } from '@/mocks/state';
import { clearAllChaosRules } from '@/mocks/chaos';

/**
 * Test environment.
 *
 * The same MSW handlers that serve the browser mock also serve the test
 * suite, so a test exercises the real HTTP client, the real error mapping
 * and the real response validation.
 *
 * The server is started before each file and closed after it: `msw/node`
 * patches the process-wide `fetch`, so an interceptor left installed would
 * shadow the next file's server and serve it stale state.
 */

/**
 * The first request in a file pays a cold-start cost — the mock handlers
 * are compiled and the environment is built — so a request can take well
 * over a second. Testing Library's default wait is 1000 ms, which made the
 * first assertion in a file fail intermittently.
 */
configure({ asyncUtilTimeout: 5_000 });

/**
 * `jsdom` does not evaluate media queries, so a component that switches
 * layout on a breakpoint would always render the narrow one. This gives the
 * test environment a real viewport, and lets a test override it.
 */
const TEST_VIEWPORT_WIDTH = 1600;

function evaluateQuery(query: string): boolean {
  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (minWidth?.[1]) return TEST_VIEWPORT_WIDTH >= Number.parseInt(minWidth[1], 10);

  const maxWidth = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (maxWidth?.[1]) return TEST_VIEWPORT_WIDTH <= Number.parseInt(maxWidth[1], 10);

  return false;
}

/**
 * `jsdom` evaluates media queries against a fixed 1024px viewport, which
 * happens to sit exactly on our `lg` breakpoint — so a component that
 * switches layout would render differently depending on the environment
 * default. Installing the mock unconditionally makes the viewport explicit
 * and stable.
 */
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: evaluateQuery(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
});

/**
 * jsdom implements no layout, and ProseMirror queries `getClientRects` when
 * it scrolls its selection into view — a crash without this. An empty list
 * is enough: the numbers are only used for scrolling, which does not exist
 * in the test environment.
 */
function emptyRectList(): DOMRectList {
  return [] as unknown as DOMRectList;
}

function zeroRect(): DOMRect {
  return new DOMRect(0, 0, 0, 0);
}

if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = emptyRectList;
}
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = zeroRect;
}
if (typeof Element.prototype.getClientRects !== 'function') {
  Element.prototype.getClientRects = emptyRectList;
}
// Hit-testing does not exist either; "nothing is under this point" is the
// correct answer, and ProseMirror treats a null result as "no position".
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null;
}

beforeAll(() => {
  startMockServer();
});

afterEach(() => {
  cleanup();
  resetState();
  clearAllChaosRules();
  // Handlers installed with `server.use()` are test-scoped: without this
  // they would outlive the test and answer the next file's requests.
  server.resetHandlers();
});

afterAll(() => {
  stopMockServer();
});
