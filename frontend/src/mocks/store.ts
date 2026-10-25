/**
 * A tiny persistent store for the mock backend.
 *
 * The MSW handlers run in the page context, so an in-memory object would be
 * lost on every reload — a signed-in user would be signed out by a refresh,
 * and an in-flight research run would vanish. The real backend keeps this
 * state on the server; here it lives in `localStorage`, which behaves the
 * same way from the application's point of view.
 *
 * In Node (tests) there is no `localStorage`, so an in-memory map is used
 * instead.
 */

const memory = new Map<string, string>();

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    // Access itself can throw when storage is blocked by policy.
    return null;
  }
}

export function readValue<T>(key: string, fallback: T): T {
  const store = storage();
  const raw = store ? store.getItem(key) : memory.get(key);
  if (raw === null || raw === undefined) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeValue<T>(key: string, value: T): void {
  const serialised = JSON.stringify(value);
  const store = storage();

  try {
    if (store) store.setItem(key, serialised);
    else memory.set(key, serialised);
  } catch {
    // Storage may be full or blocked. The in-memory copy still works.
  }
}

export function removeValue(key: string): void {
  const store = storage();
  try {
    if (store) store.removeItem(key);
    else memory.delete(key);
  } catch {
    // Nothing to do.
  }
}

export const MOCK_KEYS = {
  session: 'oppulse:mock:session',
  runs: 'oppulse:mock:runs',
  onboarding: 'oppulse:mock:onboarding',
  state: 'oppulse:mock:state',
} as const;
