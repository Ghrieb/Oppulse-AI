import { describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { z } from 'zod';
import { apiClient } from './client';
import { ApiError } from './errors';
import { opportunityListSchema } from '../schemas';
import { server } from '@/mocks/server';
import { apiUrl } from '@/mocks/handlers/urls';

/**
 * The HTTP client is the only data-access path in the application, so its
 * failure behaviour is worth testing directly against the mock server.
 */
describe('apiClient', () => {
  it('returns a schema-validated payload', async () => {
    const result = await apiClient.get('/opportunities', { schema: opportunityListSchema });

    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(result.matches.length).toBeGreaterThan(0);
    // Parsing through Zod means the fixture really does satisfy the contract.
    expect(result.opportunities[0]?.deadline).toBeDefined();
  });

  it('maps a 404 onto a NOT_FOUND ApiError', async () => {
    await expect(
      apiClient.get('/opportunities/00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      retryable: false,
    });
  });

  it('maps a validation failure onto field errors', async () => {
    let caught: unknown = null;

    try {
      await apiClient.post('/auth/sign-in', { email: 'not-an-email', password: 'x' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as ApiError;
    expect(apiError.code).toBe('VALIDATION');
    expect(apiError.fieldErrors?.email).toBeDefined();
  });

  it('rejects a response that does not match the contract', async () => {
    await expect(
      apiClient.get('/opportunities', {
        schema: z.object({ totallyUnexpected: z.string() }),
      }),
    ).rejects.toMatchObject({
      code: 'CONTRACT_MISMATCH',
    });
  });

  it('reads a 204 response as an empty payload', async () => {
    await expect(apiClient.post('/auth/sign-out')).resolves.toBeUndefined();
  });

  it('sends the Idempotency-Key with the request it names', async () => {
    const keys: Array<string | null> = [];

    server.use(
      http.post(apiUrl('/missions/:id/runs'), ({ request }) => {
        keys.push(request.headers.get('idempotency-key'));
        return HttpResponse.json({
          runId: '11111111-1111-4111-8111-111111111111',
          status: 'queued',
        });
      }),
    );

    const path = '/missions/00000000-0000-4000-8000-000000000000/runs';
    await apiClient.post(path, undefined, { idempotencyKey: 'intent-once' });
    await apiClient.post(path, undefined, { idempotencyKey: 'intent-once' });

    expect(keys).toEqual(['intent-once', 'intent-once']);
  });

  it('sends no Idempotency-Key when the caller names no intent', async () => {
    let seen: string | null = 'untouched';

    server.use(
      http.post(apiUrl('/missions/:id/runs'), ({ request }) => {
        seen = request.headers.get('idempotency-key');
        return HttpResponse.json({
          runId: '11111111-1111-4111-8111-111111111111',
          status: 'queued',
        });
      }),
    );

    await apiClient.post('/missions/00000000-0000-4000-8000-000000000000/runs');

    expect(seen).toBeNull();
  });

  it('reports CANCELLED when the caller aborts before the request leaves', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      apiClient.get('/opportunities', { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: 'CANCELLED',
      retryable: false,
    });
  });

  it('reports CANCELLED, not TIMEOUT, when the caller aborts mid-flight', async () => {
    server.use(
      http.get(apiUrl('/profile'), async () => {
        await delay(1000);
        return HttpResponse.json({});
      }),
    );

    const controller = new AbortController();
    const pending = apiClient.get('/profile', { signal: controller.signal });
    setTimeout(() => controller.abort(), 25);

    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
