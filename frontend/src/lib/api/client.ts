import type { z } from 'zod';
import { ApiError, toApiError } from './errors';
import { API_PREFIX, API_BASE_URL, DEFAULT_TIMEOUT_MS, buildUrl } from './config';
import { logger } from '../logger';

/**
 * The single HTTP data-access path for the entire application.
 *
 * Every network call in Oppulse AI goes through `apiClient`. There is no
 * second client and no hand-written mock client: in mock mode, MSW
 * intercepts these very requests at the network layer and serves fixtures.
 * Switching to a live backend therefore changes nothing in this file, in the
 * hooks, or in any component.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions<TSchema extends z.ZodType = z.ZodType> {
  method?: HttpMethod;
  /** Serialised as JSON. A `File` is sent as the raw request body. */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Caller-supplied cancellation (e.g. a React Query abort signal). */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Response schema. When present, the payload is validated before it is returned. */
  schema?: TSchema;
  headers?: Record<string, string>;
  /**
   * Names this request as one intent, sent as `Idempotency-Key`.
   *
   * The server remembers the first successful response for a key, so a
   * repeat of the same intent is answered with that response instead of
   * doing the work a second time. The key belongs to the *intent* — it is
   * created when the user asks for the action, not per attempt, so a
   * retry of one intent reuses it.
   */
  idempotencyKey?: string;
}

/** Supplies the bearer token for the current session, if any. */
type TokenProvider = () => string | null;

let tokenProvider: TokenProvider = () => null;

/**
 * Registers the source of the current session token.
 * Phase B wires this to the auth store; today it is a no-op.
 */
export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

function randomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function newRequestId(): string {
  return randomId('req');
}

/**
 * A fresh `Idempotency-Key` for one intent.
 *
 * A new key means a new action: the second click on "start" is a second
 * intent and must not be answered with the first one's run. Reusing a key
 * means the same action, which is exactly when the server must not repeat
 * the work — so the key is created once, where the intent is created, and
 * travels with the mutation's variables through any retry.
 */
export function newIdempotencyKey(): string {
  return randomId('idem');
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

/**
 * A file body.
 *
 * A document is uploaded as the raw request body, not as multipart form
 * data: one file does not need a multipart envelope, and a multipart body
 * cannot be read back by the mock in the Node test runtime, which would
 * make the prototype and the tests behave differently.
 */
function isBinaryBody(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

/**
 * Names the uploaded file, in a way that survives a non-ASCII name.
 *
 * The plain `filename` is an ASCII fallback; `filename*` carries the real
 * name per RFC 5987.
 */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  if (raw.length === 0) return undefined;

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      // A malformed JSON body is a server bug, not a user error.
      throw new ApiError({
        code: 'CONTRACT_MISMATCH',
        message: 'The server returned a response we could not read.',
        status: response.status,
        requestId: response.headers.get('x-request-id') ?? undefined,
        retryable: false,
        fieldErrors: undefined,
        details: undefined,
        cause: undefined,
      });
    }
  }

  return raw;
}

/**
 * Performs an API request and returns a schema-validated payload.
 *
 * The response type is inferred from the schema, so a caller that passes
 * `schema: opportunityListSchema` receives the parsed opportunity list and
 * nothing else.
 *
 * @throws {ApiError} for every failure mode, so callers only handle one type.
 */
export async function apiRequest<TSchema extends z.ZodType>(
  path: string,
  options: ApiRequestOptions<TSchema>,
): Promise<z.infer<TSchema>>;
export async function apiRequest(path: string, options?: ApiRequestOptions): Promise<unknown>;
export async function apiRequest<TSchema extends z.ZodType = z.ZodType>(
  path: string,
  options: ApiRequestOptions<TSchema> = {},
): Promise<z.infer<TSchema>> {
  const {
    method = 'GET',
    body,
    query,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    schema,
    headers: extraHeaders,
    idempotencyKey,
  } = options;

  const requestId = newRequestId();
  const url = buildUrl(path, query);
  const controller = new AbortController();

  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abortFromCaller();
    else signal.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timer = setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);

  const token = tokenProvider();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': requestId,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    ...extraHeaders,
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (isBinaryBody(body)) {
      // The browser sets the length; the type comes from the file itself.
      headers['Content-Type'] = body.type || 'application/octet-stream';
      payload = body;
    } else if (isFormData(body)) {
      payload = body;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const startedAt = performance.now();
  let response: Response;

  const init: RequestInit = {
    method,
    headers,
    signal: controller.signal,
    credentials: 'include',
  };
  if (payload !== undefined) init.body = payload;

  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (signal?.aborted) throw ApiError.cancelled(requestId);
    if (controller.signal.aborted) throw ApiError.timeout(requestId, timeoutMs);
    throw ApiError.network(cause, requestId);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const responseRequestId = response.headers.get('x-request-id') ?? requestId;

  logger.debug('api request', {
    method,
    path,
    status: response.status,
    durationMs,
    requestId: responseRequestId,
  });

  if (!response.ok) {
    const errorBody = await readBody(response).catch(() => undefined);
    throw ApiError.fromStatus(response.status, errorBody, responseRequestId);
  }

  const data = await readBody(response);

  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      logger.error('api contract mismatch', { path, issues, requestId: responseRequestId });
      throw ApiError.contractMismatch(issues, responseRequestId, data);
    }
    return result.data;
  }

  return data as z.infer<TSchema>;
}

type ClientOptions<TSchema extends z.ZodType> = Omit<ApiRequestOptions<TSchema>, 'method' | 'body'>;

export const apiClient = {
  get: <TSchema extends z.ZodType>(
    path: string,
    options: ClientOptions<TSchema> = {},
  ): Promise<z.infer<TSchema>> =>
    apiRequest(path, { ...options, method: 'GET' } as ApiRequestOptions<TSchema>),

  post: <TSchema extends z.ZodType>(
    path: string,
    body?: unknown,
    options: ClientOptions<TSchema> = {},
  ): Promise<z.infer<TSchema>> =>
    apiRequest(path, { ...options, method: 'POST', body } as ApiRequestOptions<TSchema>),

  put: <TSchema extends z.ZodType>(
    path: string,
    body?: unknown,
    options: ClientOptions<TSchema> = {},
  ): Promise<z.infer<TSchema>> =>
    apiRequest(path, { ...options, method: 'PUT', body } as ApiRequestOptions<TSchema>),

  patch: <TSchema extends z.ZodType>(
    path: string,
    body?: unknown,
    options: ClientOptions<TSchema> = {},
  ): Promise<z.infer<TSchema>> =>
    apiRequest(path, { ...options, method: 'PATCH', body } as ApiRequestOptions<TSchema>),

  delete: <TSchema extends z.ZodType>(
    path: string,
    options: ClientOptions<TSchema> = {},
  ): Promise<z.infer<TSchema>> =>
    apiRequest(path, { ...options, method: 'DELETE' } as ApiRequestOptions<TSchema>),

  /**
   * Uploads a file as the raw request body.
   *
   * The file's name travels in `Content-Disposition` and its type in
   * `Content-Type`, so the server never has to parse a multipart envelope
   * for a single file.
   */
  upload: <TSchema extends z.ZodType>(
    path: string,
    file: File,
    options: ClientOptions<TSchema> = {},
  ): Promise<z.infer<TSchema>> =>
    apiRequest(path, {
      ...options,
      method: 'POST',
      body: file,
      headers: {
        'Content-Disposition': contentDisposition(file.name),
        ...(options.headers ?? {}),
      },
    } as ApiRequestOptions<TSchema>),
};

export { ApiError, toApiError, API_PREFIX, API_BASE_URL };
