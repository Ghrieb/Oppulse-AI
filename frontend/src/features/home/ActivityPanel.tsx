import { Link } from 'react-router-dom';
import { Activity, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, RefreshingIndicator } from '@/components/feedback/states';
import { Skeleton } from '@/components/ui/tooltip';
import { useAlerts, useRunEvents } from '@/lib/queries';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Alerts and run events.
 *
 * The workspace's factual activity feed: what the agent did, and what
 * changed on the student's behalf. It reads the same run the mission strip
 * points at, so there is one truth about the active run, not two.
 */
export function ActivityPanel({ runId }: { runId: string | null }) {
  const {
    data: events,
    isPending: eventsPending,
    isFetching: eventsFetching,
    error: eventsError,
    refetch: refetchEvents,
  } = useRunEvents(runId);
  const {
    data: alerts,
    isFetching: alertsFetching,
    error: alertsError,
    refetch: refetchAlerts,
  } = useAlerts();

  const recent = (events?.events ?? []).slice(-5).reverse();
  const unread = alerts?.unreadCount ?? 0;
  const unreadAlerts = (alerts?.alerts ?? []).filter((alert) => !alert.read).slice(0, 2);
  const refreshing = (eventsFetching && !eventsPending) || (alertsFetching && alerts !== undefined);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Activity aria-hidden="true" className="size-4 text-text-muted" />
          Activity
          {refreshing ? <RefreshingIndicator /> : null}
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/monitoring">
            <Bell aria-hidden="true" className="size-4" />
            Open monitoring{unread > 0 ? ` (${unread} unread)` : ''}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Recent research events" className="flex flex-col gap-2">
          <h3 className="text-meta font-medium text-text-muted">Research events</h3>
          {eventsError ? (
            <ErrorState
              error={eventsError}
              onRetry={() => void refetchEvents()}
              message="The run timeline could not load. Your run is unaffected."
            />
          ) : eventsPending ? (
            <Skeleton className="h-16" />
          ) : recent.length === 0 ? (
            <p className="text-sm text-text-muted">
              No research events yet. Start a run from your mission and the factual timeline will
              appear here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recent.map((event) => (
                <li key={event.id} className="rounded-button bg-surface-subtle px-3 py-2">
                  <p className="text-sm text-text">{event.message}</p>
                  <p className="mt-0.5 text-meta text-text-muted">{formatTime(event.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Unread alerts" className="flex flex-col gap-2">
          <h3 className="text-meta font-medium text-text-muted">Alerts</h3>
          {alertsError ? (
            <ErrorState
              error={alertsError}
              onRetry={() => void refetchAlerts()}
              message="Alerts could not load. Nothing was dismissed."
            />
          ) : unread === 0 ? (
            <p className="text-sm text-text-muted">No unread alerts.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {unreadAlerts.map((alert) => (
                <li key={alert.id} className="rounded-button border border-border px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text">{alert.title}</p>
                    <Badge
                      tone={
                        alert.severity === 'danger' || alert.severity === 'warning'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {alert.category.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-meta text-text-muted">{alert.body}</p>
                </li>
              ))}
              {unread > unreadAlerts.length ? (
                <Link
                  to="/monitoring"
                  className="text-meta font-medium text-primary underline-offset-2 hover:underline"
                >
                  See {unread - unreadAlerts.length} more
                </Link>
              ) : null}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
