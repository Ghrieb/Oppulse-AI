/**
 * API error taxonomy.
 *
 * Every failure that can reach the UI is normalised into an `ApiError` with a
 * stable `code`. UI code branches on the code, never on HTTP status or on
 * message text, so copy can change without breaking behaviour.
 *
 * The backend mirrors these codes in its error envelope:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "...", "request_id": "req_..." } }
 */

export const API_ERROR_CODES = [
  'NETWORK',
  'TIMEOUT',
  'CANCELLED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'CONTRACT_MISMATCH',
  'UNKNOWN',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Codes for which an automatic retry is safe and worthwhile. */
const RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  'NETWORK',
  'TIMEOUT',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
]);

export interface ApiErrorInit {
  code: ApiErrorCode;
  message: string;
  status: number | undefined;
  requestId: string | undefined;
  retryable: boolean;
  fieldErrors: Readonly<Record<string, readonly string[]>> | undefined;
  details: unknown;
  cause: unknown;
}

/** Shape of the backend error envelope. */
interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
    details?: unknown;
    field_errors?: Record<string, string[]>;
  };
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | undefined;
  readonly requestId: string | undefined;
  readonly retryable: boolean;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>> | undefined;
  readonly details: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.requestId = init.requestId;
    this.retryable = init.retryable;
    this.fieldErrors = init.fieldErrors;
    this.details = init.details;
  }

  /** Maps an HTTP status onto a stable error code. */
  static codeForStatus(status: number): ApiErrorCode {
    switch (status) {
      case 400:
      case 422:
        return 'VALIDATION';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'RATE_LIMITED';
      case 502:
      case 503:
      case 504:
        return 'PROVIDER_UNAVAILABLE';
      default:
        return 'UNKNOWN';
    }
  }

  static fromStatus(
    status: number,
    body: unknown,
    requestId: string,
    fallbackMessage?: string,
  ): ApiError {
    const envelope = (body ?? {}) as ApiErrorEnvelope;
    const payload = envelope.error;

    const rawCode = payload?.code;
    const code: ApiErrorCode =
      rawCode && (API_ERROR_CODES as readonly string[]).includes(rawCode)
        ? (rawCode as ApiErrorCode)
        : ApiError.codeForStatus(status);

    const fieldErrors = payload?.field_errors;

    return new ApiError({
      code,
      message:
        payload?.message ??
        fallbackMessage ??
        `The request failed with status ${status}. Please try again.`,
      status,
      requestId: payload?.request_id ?? requestId,
      retryable: RETRYABLE_CODES.has(code),
      fieldErrors: fieldErrors ? Object.freeze({ ...fieldErrors }) : undefined,
      details: payload?.details,
      cause: undefined,
    });
  }

  static network(cause: unknown, requestId: string): ApiError {
    return new ApiError({
      code: 'NETWORK',
      message: 'We could not reach Oppulse AI. Check your connection and try again.',
      status: undefined,
      requestId,
      retryable: true,
      fieldErrors: undefined,
      details: undefined,
      cause,
    });
  }

  static timeout(requestId: string, timeoutMs: number): ApiError {
    return new ApiError({
      code: 'TIMEOUT',
      message: `The request took longer than ${Math.round(timeoutMs / 1000)}s and was stopped.`,
      status: undefined,
      requestId,
      retryable: true,
      fieldErrors: undefined,
      details: undefined,
      cause: undefined,
    });
  }

  static cancelled(requestId: string): ApiError {
    return new ApiError({
      code: 'CANCELLED',
      message: 'The request was cancelled.',
      status: undefined,
      requestId,
      retryable: false,
      fieldErrors: undefined,
      details: undefined,
      cause: undefined,
    });
  }

  static validation(
    message: string,
    fieldErrors: Record<string, readonly string[]>,
    requestId: string,
  ): ApiError {
    return new ApiError({
      code: 'VALIDATION',
      message,
      status: 422,
      requestId,
      retryable: false,
      fieldErrors: Object.freeze({ ...fieldErrors }),
      details: undefined,
      cause: undefined,
    });
  }

  /**
   * The response did not match the typed contract. This is a bug in the
   * backend or a stale frontend — it must never be swallowed.
   */
  static contractMismatch(issues: string, requestId: string, details: unknown): ApiError {
    return new ApiError({
      code: 'CONTRACT_MISMATCH',
      message:
        'The server response did not match the expected format. This is a bug — please report it.',
      status: undefined,
      requestId,
      retryable: false,
      fieldErrors: undefined,
      details: { issues, details },
      cause: undefined,
    });
  }

  /** Human-facing, jargon-free copy for toasts and error states. */
  get userMessage(): string {
    return this.message;
  }
}

/** Type guard for `ApiError`. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Normalises any thrown value into an `ApiError`. */
export function toApiError(value: unknown, requestId?: string): ApiError {
  if (isApiError(value)) return value;
  if (value instanceof Error) {
    return new ApiError({
      code: 'UNKNOWN',
      message: 'Something went wrong. Please try again.',
      status: undefined,
      requestId,
      retryable: false,
      fieldErrors: undefined,
      details: undefined,
      cause: value,
    });
  }
  return new ApiError({
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
    status: undefined,
    requestId,
    retryable: false,
    fieldErrors: undefined,
    details: undefined,
    cause: value,
  });
}
