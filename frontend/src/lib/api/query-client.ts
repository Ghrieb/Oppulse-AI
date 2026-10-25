import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';
import { logger } from '../logger';

/**
 * React Query client.
 *
 * Errors are rendered as state rather than thrown to an error boundary, so
 * `throwOnError` stays off. Retries are limited to errors that are actually
 * transient (network, timeout, rate limit, provider outage) and never exceed
 * two attempts, so a broken backend fails fast and visibly.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            return error.retryable && failureCount < 2;
          }
          return false;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: false,
        onError: (error) => {
          logger.warn('mutation failed', {
            error: error instanceof Error ? error.message : String(error),
            code: error instanceof ApiError ? error.code : 'UNKNOWN',
          });
        },
      },
    },
  });
}
