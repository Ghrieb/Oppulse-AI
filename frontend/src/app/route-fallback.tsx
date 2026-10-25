import { Skeleton } from '@/components/ui/tooltip';
import { ErrorState } from '@/components/feedback/states';

/** Suspense fallback for lazily loaded routes. */
export function RouteFallback() {
  return (
    <div className="flex flex-col gap-4 p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

/** Router-level error element. */
export function RouteErrorFallback({ error }: { error?: unknown }) {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <ErrorState error={error} />
    </div>
  );
}
