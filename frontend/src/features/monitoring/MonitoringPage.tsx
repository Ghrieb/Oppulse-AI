import { Link } from 'react-router-dom';
import { Bell, BellOff, CalendarClock, Pause, Play, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/tooltip';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import { useToast } from '@/lib/hooks/use-toast';
import {
  useAlerts,
  useMarkAlertRead,
  useMonitorEvents,
  useMonitorTargets,
  useUpdateMonitorTarget,
} from '@/lib/queries';
import type { Alert, MonitorEvent, MonitorTarget } from '@/lib/schemas';
import { deliveryLabel } from '@/lib/notifications';

const EVENT_LABEL: Record<MonitorEvent['type'], string> = {
  deadline_changed: 'Deadline changed',
  applications_opened: 'Applications opened',
  funding_updated: 'Funding updated',
  eligibility_changed: 'Eligibility changed',
  new_opportunity: 'New opportunity',
  page_unreachable: 'Source unreachable',
  content_updated: 'Content updated',
};

const SEVERITY_TONE: Record<Alert['severity'], 'info' | 'success' | 'warning' | 'danger'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/**
 * Monitoring and alerts.
 *
 * Monitoring is scheduled, not real-time. The interface always shows the
 * last successful check and the next scheduled check, and never claims to
 * be watching a page continuously (spec §9.2).
 */
export function MonitoringPage() {
  const { data: targets, isPending, error, refetch } = useMonitorTargets();
  const { data: events } = useMonitorEvents();
  const { data: alerts } = useAlerts();

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Monitoring and alerts" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Monitoring and alerts"
        description="The agent re-checks the sources you saved and tells you when something meaningful changed. Checks run on a schedule — this is not a live feed."
      />

      <Tabs defaultValue="targets">
        <TabsList>
          <TabsTrigger value="targets">Targets ({targets?.targets.length ?? 0})</TabsTrigger>
          <TabsTrigger value="events">Changes ({events?.events.length ?? 0})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts?.unreadCount ?? 0} unread)</TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="pt-4">
          {isPending ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1].map((index) => (
                <Skeleton key={index} className="h-44" />
              ))}
            </div>
          ) : targets.targets.length === 0 ? (
            <EmptyState
              icon={<Bell className="size-5" />}
              title="Nothing is being monitored"
              description="Save a mission or a specific opportunity and the agent will keep checking its official source for changes."
              action={
                <Button asChild size="sm">
                  <Link to="/opportunities">Find something to track</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {targets.targets.map((target) => (
                <MonitorCard key={target.id} target={target} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="pt-4">
          {(events?.events.length ?? 0) === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-5" />}
              title="No changes detected yet"
              description="When a monitored source changes in a way that affects you, the event is recorded here with the before-and-after detail."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {events?.events.map((event) => (
                <li key={event.id} className="rounded-card border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={event.type === 'page_unreachable' ? 'warning' : 'info'}>
                        {EVENT_LABEL[event.type]}
                      </Badge>
                      {event.isTestEvent ? (
                        <Badge tone="neutral">Controlled test event</Badge>
                      ) : null}
                    </div>
                    <span className="text-meta text-text-muted">
                      {new Date(event.detectedAt).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <dl className="mt-3 flex flex-col gap-2 text-sm">
                    <div>
                      <dt className="text-meta font-medium text-text-muted">What changed</dt>
                      <dd className="text-text">{event.whatChanged}</dd>
                    </div>
                    <div>
                      <dt className="text-meta font-medium text-text-muted">
                        Why it matters to you
                      </dt>
                      <dd className="text-text">{event.whyItMatters}</dd>
                    </div>
                    <div>
                      <dt className="text-meta font-medium text-text-muted">What to do next</dt>
                      <dd className="text-text">{event.recommendedAction}</dd>
                    </div>
                  </dl>

                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-block text-meta text-info underline-offset-2 hover:underline"
                  >
                    {sourceLabel(event.sourceUrl)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="pt-4">
          {(alerts?.alerts.length ?? 0) === 0 ? (
            <EmptyState
              icon={<BellOff className="size-5" />}
              title="No alerts"
              description="Alerts appear here when a monitored source changes in a way that affects your applications."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {alerts?.alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MonitorCard({ target }: { target: MonitorTarget }) {
  const updateTarget = useUpdateMonitorTarget();
  const { toast } = useToast();
  const isPaused = target.status === 'paused';

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">{target.label}</h2>
        <Badge tone={target.status === 'error' ? 'warning' : isPaused ? 'neutral' : 'success'}>
          {target.status === 'error' ? 'Check failed' : isPaused ? 'Paused' : 'Active'}
        </Badge>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-meta text-text-muted">Frequency</dt>
          <dd className="text-text">{target.frequency}</dd>
        </div>
        <div>
          <dt className="text-meta text-text-muted">Events detected</dt>
          <dd className="text-text">{target.eventsDetected}</dd>
        </div>
        <div>
          <dt className="text-meta text-text-muted">Last successful check</dt>
          <dd className="text-text">
            {target.lastSuccessfulCheckAt
              ? new Date(target.lastSuccessfulCheckAt).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'No successful check yet'}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-text-muted">Next scheduled check</dt>
          <dd className="text-text">
            {target.nextScheduledCheckAt
              ? new Date(target.nextScheduledCheckAt).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'Not scheduled'}
          </dd>
        </div>
      </dl>

      {target.sourceUnreachable ? (
        <p className="flex items-start gap-2 rounded-button bg-warning-surface px-3 py-2 text-meta text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          The last check could not reach this source. No conclusion is drawn about the opportunity.
        </p>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          loading={updateTarget.isPending}
          loadingLabel={isPaused ? 'Resuming…' : 'Pausing…'}
          onClick={() =>
            updateTarget.mutate(
              { id: target.id, status: isPaused ? 'active' : 'paused' },
              {
                onSuccess: () =>
                  toast({
                    tone: 'success',
                    title: isPaused ? 'Monitoring resumed' : 'Monitoring paused',
                  }),
              },
            )
          }
        >
          {isPaused ? (
            <>
              <Play aria-hidden="true" className="size-4" />
              Resume
            </>
          ) : (
            <>
              <Pause aria-hidden="true" className="size-4" />
              Pause
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function sourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function AlertCard({ alert }: { alert: Alert }) {
  const markRead = useMarkAlertRead();

  return (
    <li
      className={
        'rounded-card border p-4 ' +
        (alert.read ? 'border-border bg-surface' : 'border-primary/25 bg-primary/5')
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-text">{alert.title}</h3>
          <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
        </div>
        <span className="text-meta text-text-muted">
          {new Date(alert.createdAt).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </div>

      <p className="mt-2 text-sm text-text-muted">{alert.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {alert.delivery.channels
          .filter((channel) => channel.status !== 'delivered')
          .map((channel) => (
            <span
              key={channel.channel}
              className="text-meta text-text-muted"
              data-channel={channel.channel}
            >
              In-app:{' '}
              {deliveryLabel({
                status: channel.status,
                error: channel.error,
                sensitivity: alert.sensitivity,
              })}
            </span>
          ))}
        {!alert.read ? (
          <Button
            variant="ghost"
            size="sm"
            loading={markRead.isPending}
            loadingLabel="Marking…"
            onClick={() => markRead.mutate(alert.id)}
          >
            Mark as read
          </Button>
        ) : null}
      </div>
    </li>
  );
}
