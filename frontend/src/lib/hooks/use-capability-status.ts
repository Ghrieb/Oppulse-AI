import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { capabilityStatusSchema } from '@/lib/schemas';

/**
 * Capability status.
 *
 * Answers "what actually works right now" in one place, so the interface
 * never has to make a blanket claim about the product.
 */
export function useCapabilityStatus() {
  return useQuery({
    queryKey: ['capabilities'] as const,
    queryFn: ({ signal }) =>
      apiClient.get('/capabilities', { schema: capabilityStatusSchema, signal }),
    staleTime: 5 * 60_000,
  });
}

/** Convenience accessor with a safe fallback for a public page. */
export function useIsPrototype(): boolean {
  const { data } = useCapabilityStatus();
  return data?.isPrototype ?? true;
}
