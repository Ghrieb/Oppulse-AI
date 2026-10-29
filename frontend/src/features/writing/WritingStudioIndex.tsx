import { Navigate } from 'react-router-dom';
import { RouteFallback } from '@/app/route-fallback';
import { ErrorState } from '@/components/feedback/states';
import { useApplications } from '@/lib/queries';

/**
 * Writing studio entry point.
 *
 * The sidebar links to `/writing`, but a draft needs its own URL. This
 * resolves the first draft the student has and hands off to it, so the
 * nav link always lands somewhere useful; with no drafts yet it returns
 * to the workspace where drafts are created.
 */
export function WritingStudioIndex() {
  const { data, isPending, error, refetch } = useApplications();

  if (isPending) return <RouteFallback />;
  if (error) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const firstDraftId = data.applications.find(
    (application) => application.draftIds.length > 0,
  )?.draftIds[0];

  if (!firstDraftId) return <Navigate to="/applications" replace />;
  return <Navigate to={`/writing/${firstDraftId}`} replace />;
}
