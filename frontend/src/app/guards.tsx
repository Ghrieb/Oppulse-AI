import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorState } from '@/components/feedback/states';
import { Skeleton } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { useSession } from '@/lib/queries';

/**
 * Route guard.
 *
 * Protected routes send a signed-out visitor to sign-in and remember where
 * they were heading, so they land back on the right page afterwards
 * instead of on a generic home screen.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isPending, error, refetch } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6" aria-busy="true">
        <span className="sr-only">Checking your session</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    const code = error instanceof ApiError ? error.code : 'UNKNOWN';

    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
      const next = `${location.pathname}${location.search}`;
      return <Navigate to={`/auth/sign-in?next=${encodeURIComponent(next)}`} replace />;
    }

    return (
      <div className="mx-auto max-w-2xl p-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return <>{children}</>;
}
