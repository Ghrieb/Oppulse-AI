import { HttpResponse, delay } from 'msw';

/**
 * Chaos injection.
 *
 * The error states in this product are only worth anything if they are
 * actually executed. Chaos lets a developer (or a reviewer) force a real
 * failure on a real endpoint and watch the interface handle it.
 *
 * Rules are held in module state, which is shared with the page context in
 * the browser, so a dev panel can toggle them live.
 */

export type ChaosMode = 'error' | 'slow' | 'empty' | 'offline';

export interface ChaosRule {
  /** Substring matched against the request path, e.g. `/opportunities`. */
  pattern: string;
  mode: ChaosMode;
  /** HTTP status for `error` mode. Defaults to 500. */
  status?: number;
  /** Delay in ms for `slow` mode. Defaults to 8000 (past the client timeout). */
  delayMs: number;
}

const rules: ChaosRule[] = [];

export function setChaosRule(rule: ChaosRule): void {
  const index = rules.findIndex((existing) => existing.pattern === rule.pattern);
  if (index >= 0) rules[index] = rule;
  else rules.push(rule);
}

export function clearChaosRule(pattern: string): void {
  const index = rules.findIndex((rule) => rule.pattern === pattern);
  if (index >= 0) rules.splice(index, 1);
}

export function listChaosRules(): ChaosRule[] {
  return [...rules];
}

export function clearAllChaosRules(): void {
  rules.length = 0;
}

function matches(pathname: string, pattern: string): boolean {
  return pathname.includes(pattern);
}

/**
 * Applies any matching chaos rule.
 * Returns a response to short-circuit with, or `null` to continue normally.
 */
export async function applyChaos(pathname: string): Promise<Response | null> {
  const rule = rules.find((candidate) => matches(pathname, candidate.pattern));
  if (!rule) return null;

  switch (rule.mode) {
    case 'error': {
      await delay(120);
      const status = rule.status ?? 500;
      const code =
        status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 429
              ? 'RATE_LIMITED'
              : status >= 502 && status <= 504
                ? 'PROVIDER_UNAVAILABLE'
                : 'UNKNOWN';
      const message =
        code === 'UNAUTHORIZED'
          ? 'Your session has expired. Sign in again to continue.'
          : code === 'FORBIDDEN'
            ? 'You do not have access to this resource.'
            : code === 'RATE_LIMITED'
              ? 'The research provider is rate limiting requests. Try again in a moment.'
              : code === 'PROVIDER_UNAVAILABLE'
                ? 'The research provider is temporarily unavailable. Your mission is saved.'
                : 'The server could not complete this request.';
      return HttpResponse.json(
        {
          error: {
            code,
            message,
            request_id: 'req_chaos_demo',
          },
        },
        { status },
      );
    }
    case 'slow': {
      await delay(rule.delayMs);
      return null;
    }
    case 'empty': {
      await delay(150);
      return HttpResponse.json([]);
    }
    case 'offline': {
      // A real network failure, not an HTTP status: the client turns it into
      // its NETWORK code, so the offline state and banner run exactly as they
      // do when the connection drops for real.
      return HttpResponse.error();
    }
    default:
      return null;
  }
}
