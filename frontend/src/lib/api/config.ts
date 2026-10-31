/**
 * API configuration — the single source of truth for where the API lives.
 *
 * Both the HTTP client and the MSW handlers import `API_BASE_URL` from this
 * module, so the two can never disagree about the API origin. That is what
 * allows mock mode and live mode to share a single request shape.
 */

/** Origin of the Oppulse AI API (no trailing slash). */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL ??
  // A Vercel deployment serves the SPA and FastAPI function from one origin.
  // `localhost` here would point at the visitor's computer, not the deployed
  // API, which makes every sign-in or sign-up request fail in production.
  (typeof window === 'undefined' ? 'http://localhost:8000' : window.location.origin)
).replace(/\/+$/, '');

/** Versioned API prefix used by every backend endpoint. */
export const API_PREFIX = '/api/v1';

/** True when the app is running against fixtures rather than a live backend. */
export const IS_MOCK_MODE: boolean = (import.meta.env.VITE_API_MODE ?? 'live') === 'mock';

/**
 * The hosted submission is deliberately browsable without an account or a
 * database. Set this to `false` only when the production database and auth
 * service are ready to take over.
 */
export const GUEST_DEMO_MODE: boolean = import.meta.env.VITE_GUEST_DEMO === 'true';

/** Whether browser requests are served by the persisted fixture workspace. */
export const USE_FIXTURE_BACKEND: boolean = IS_MOCK_MODE || GUEST_DEMO_MODE;

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
  import.meta.env.VITE_SHOW_PROTOTYPE_BANNER === 'true' || USE_FIXTURE_BACKEND;

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
