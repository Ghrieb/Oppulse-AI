/**
 * API configuration — the single source of truth for where the API lives.
 *
 * Both the HTTP client and the MSW handlers import `API_BASE_URL` from this
 * module, so the two can never disagree about the API origin. That is what
 * allows mock mode and live mode to share a single request shape.
 */

/** Origin of the Oppulse AI API (no trailing slash). */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
).replace(/\/+$/, '');

/** Versioned API prefix used by every backend endpoint. */
export const API_PREFIX = '/api/v1';

/** True when the app is running against fixtures rather than a live backend. */
export const IS_MOCK_MODE: boolean = (import.meta.env.VITE_API_MODE ?? 'mock') === 'mock';

/** Product surface: which disclosure the app shows about its data. */
export type ProductMode = 'demo' | 'student_testing';

/**
 * `demo` keeps the synthetic-data disclosure. `student_testing` replaces it
 * with per-capability status (live / simulated / unavailable), so a reviewer
 * sees exactly what works rather than one blanket claim.
 */
export const PRODUCT_MODE: ProductMode =
  import.meta.env.VITE_PRODUCT_MODE === 'student_testing' ? 'student_testing' : 'demo';

/** Whether to display the "sample data" banner. */
export const SHOW_PROTOTYPE_BANNER: boolean =
  import.meta.env.VITE_SHOW_PROTOTYPE_BANNER === 'true' || IS_MOCK_MODE;

/** Default request timeout. Research-adjacent calls override this. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Builds an absolute API URL.
 *
 * @param path - Path relative to the API prefix, e.g. `/opportunities`.
 * @param query - Optional query parameters. `undefined`/`null` values are omitted.
 */
export function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${API_PREFIX}${normalisedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}
