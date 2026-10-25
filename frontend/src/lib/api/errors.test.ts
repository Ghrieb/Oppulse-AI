import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './errors';

/**
 * The error taxonomy is what the whole interface branches on, so its
 * mapping is worth pinning down.
 */
describe('ApiError', () => {
  it('maps HTTP statuses onto stable codes', () => {
    expect(ApiError.codeForStatus(400)).toBe('VALIDATION');
    expect(ApiError.codeForStatus(401)).toBe('UNAUTHORIZED');
    expect(ApiError.codeForStatus(403)).toBe('FORBIDDEN');
    expect(ApiError.codeForStatus(404)).toBe('NOT_FOUND');
    expect(ApiError.codeForStatus(409)).toBe('CONFLICT');
    expect(ApiError.codeForStatus(422)).toBe('VALIDATION');
    expect(ApiError.codeForStatus(429)).toBe('RATE_LIMITED');
    expect(ApiError.codeForStatus(503)).toBe('PROVIDER_UNAVAILABLE');
    expect(ApiError.codeForStatus(418)).toBe('UNKNOWN');
  });

  it('reads the backend error envelope', () => {
    const error = ApiError.fromStatus(
      422,
      {
        error: {
          code: 'VALIDATION',
          message: 'That email is already registered.',
          request_id: 'req_123',
          field_errors: { email: ['That email is already registered.'] },
        },
      },
      'req_fallback',
    );

    expect(error.code).toBe('VALIDATION');
    expect(error.message).toBe('That email is already registered.');
    expect(error.requestId).toBe('req_123');
    expect(error.fieldErrors?.email).toEqual(['That email is already registered.']);
    expect(error.retryable).toBe(false);
  });

  it('marks only transient failures as retryable', () => {
    expect(ApiError.network(new Error('offline'), 'req_1').retryable).toBe(true);
    expect(ApiError.timeout('req_1', 15000).retryable).toBe(true);
    expect(ApiError.fromStatus(429, undefined, 'req_1').retryable).toBe(true);
    expect(ApiError.fromStatus(503, undefined, 'req_1').retryable).toBe(true);

    expect(ApiError.fromStatus(400, undefined, 'req_1').retryable).toBe(false);
    expect(ApiError.fromStatus(404, undefined, 'req_1').retryable).toBe(false);
    expect(ApiError.fromStatus(401, undefined, 'req_1').retryable).toBe(false);
  });

  it('falls back to a status-derived code when the envelope is missing', () => {
    const error = ApiError.fromStatus(404, undefined, 'req_1');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('status 404');
  });

  it('never leaks a raw stack into the user-facing message', () => {
    const error = new ApiError({
      code: 'UNKNOWN',
      message: 'Something went wrong. Please try again.',
      status: undefined,
      requestId: undefined,
      retryable: false,
      fieldErrors: undefined,
      details: undefined,
      cause: new Error('secret internal detail'),
    });

    expect(error.userMessage).not.toContain('secret internal detail');
  });

  it('normalises unknown throwables', () => {
    const error = toApiError(new Error('boom'), 'req_1');
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('UNKNOWN');
    expect(error.retryable).toBe(false);
  });
});
