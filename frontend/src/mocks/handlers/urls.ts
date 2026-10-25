import { API_BASE_URL, API_PREFIX } from '@/lib/api/config';

/**
 * Absolute URL builder for MSW handlers.
 *
 * The same `API_BASE_URL` constant used by the HTTP client is used here, so
 * a handler can never be registered against a different origin than the one
 * the app calls. In the browser this resolves to the dev server origin; in
 * Vitest it resolves to the configured test origin.
 */
export function apiUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${normalised}`;
}
