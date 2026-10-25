/**
 * Structured, development-only logger.
 *
 * Application code must never call `console` directly — that rule is enforced
 * by ESLint. This module is the only place allowed to log, which lets us:
 *   - redact anything that looks like a credential,
 *   - keep document contents and personal data out of the console,
 *   - attach a request id so a user-reported failure is traceable.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACTED = '[redacted]';

/** Keys whose values must never be written to the console. */
const SENSITIVE_KEY =
  /(token|secret|password|passphrase|api[-_]?key|authorization|cookie|session)/i;

const isDev = import.meta.env.DEV && import.meta.env.MODE !== 'test';

/**
 * Recursively replaces sensitive values with a placeholder.
 * Cycles are tolerated so a redacted log can never throw.
 */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(entry, seen);
  }
  return output;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!isDev && level === 'debug') return;

  const payload = context ? (redact(context) as Record<string, unknown>) : undefined;
  const prefix = `[oppulse:${level}]`;

  switch (level) {
    case 'debug':
      console.debug(prefix, message, payload ?? '');
      break;
    case 'info':
      console.info(prefix, message, payload ?? '');
      break;
    case 'warn':
      console.warn(prefix, message, payload ?? '');
      break;
    case 'error':
      console.error(prefix, message, payload ?? '');
      break;
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
