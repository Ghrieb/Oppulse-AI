import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellOff,
  CalendarClock,
  CircleCheck,
  Ellipsis,
  Pause,
  Play,
  Plus,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, StatCard } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import { useToast } from '@/lib/hooks/use-toast';
import {
  useAlerts,
  useCreateMonitorTarget,
  useMarkAlertRead,
  useMonitorEvents,
  useMonitorTargets,
  useUpdateMonitorTarget,
} from '@/lib/queries';
import type { Alert, MonitorEvent, MonitorFrequency, MonitorTarget } from '@/lib/schemas';
import { deliveryLabel } from '@/lib/notifications';
import { cn } from '@/lib/cn';

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

const FREQUENCY_LABEL: Record<MonitorFrequency, string> = {
  hourly: 'Every hour',
  daily: 'Once a day',
  weekly: 'Once a week',
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Monitoring and alerts.
 *
 * Monitoring is scheduled, not real-time. The interface always shows the
 * last successful check and the next scheduled check, and never claims to
 * be watching a page continuously (spec §9.2).
 */
export function MonitoringPage() {
  const targetsQuery = useMonitorTargets();
  const { data: targets, isPending, error, refetch, dataUpdatedAt } = targetsQuery;
  const { data: events, refetch: refetchEvents } = useMonitorEvents();
  const { data: alerts, refetch: refetchAlerts } = useAlerts();
  const [addOpen, setAddOpen] = useState(false);

  const refreshAll = () => {
    void Promise.all([refetch(), refetchEvents(), refetchAlerts()]);
  };

  const unreachable = targets?.targets.filter((target) => target.sourceUnreachable) ?? [];

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Monitoring & Alerts" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Monitoring & Alerts"
        description="The agent re-checks the sources you saved and tells you when something meaningful changed. Checks run on a schedule — this is not a live feed."
        actions={
          <div className="flex flex-col items-end gap-2">
            <span className="text-meta text-text-muted">
              Last updated {dataUpdatedAt ? formatTimestamp(new Date(dataUpdatedAt).toISOString()) : '—'}
            </span>
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active targets"
          value={targets?.targets.filter((target) => target.status === 'active').length ?? 0}
          hint="Scheduled checks"
          tone="info"
          icon={<Bell className="size-4" />}
        />
        <StatCard
          label="New changes"
          value={events?.events.length ?? 0}
          hint="Since your last review"
          tone="success"
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Unread alerts"
          value={alerts?.unreadCount ?? 0}
          hint="Need your attention"
          tone="warning"
          icon={<BellOff className="size-4" />}
        />
        <StatCard
          label="Unavailable sources"
          value={targets?.targets.filter((target) => target.sourceUnreachable).length ?? 0}
          hint="No conclusion drawn"
          tone="danger"
          icon={<TriangleAlert className="size-4" />}
        />
      </div>

      {unreachable.length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning-surface px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-text">
                {unreachable.length === 1
                  ? 'One source could not be reached'
                  : `${unreachable.length} sources could not be reached`}
              </span>
              <span className="text-sm text-text-muted">
                The last check did not reach {unreachable.length === 1 ? 'this source' : 'these sources'}. No
                conclusion was drawn about {unreachable.length === 1 ? 'the opportunity' : 'the opportunities'}.
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Retry
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="targets">
        <TabsList>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="events">Changes</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-section font-semibold text-text">Monitoring targets</h2>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Add target
            </Button>
          </div>

          {isPending ? (
            <div className="flex flex-col gap-3">
              {[0, 1].map((index) => (
                <Skeleton key={index} className="h-20" />
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
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <caption className="sr-only">
                    Monitoring targets, their status, last check, next check and detected events.
                  </caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-subtle/60 text-left">
                      <th scope="col" className="px-4 py-3 font-medium text-text-muted">
                        Target
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-text-muted">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-text-muted">
                        Last check
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-text-muted">
                        Next check
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-text-muted">
                        Events
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium text-text-muted">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.targets.map((target) => (
                      <TargetRow key={target.id} target={target} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
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

      <AddTargetDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

/** One row of the monitoring targets table. */
function TargetRow({ target }: { target: MonitorTarget }) {
  const updateTarget = useUpdateMonitorTarget();
  const { toast } = useToast();
  const isPaused = target.status === 'paused';
  const failed = target.status === 'error';

  const changeFrequency = (frequency: MonitorFrequency) =>
    updateTarget.mutate(
      { id: target.id, frequency },
      {
        onSuccess: () =>
          toast({ tone: 'success', title: `Now checking ${FREQUENCY_LABEL[frequency].toLowerCase()}` }),
      },
    );

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-subtle/40">
      <th scope="row" className="max-w-20 truncate px-4 py-3.5 text-left font-medium text-text">
        <span className="block truncate" title={target.label}>
          {target.label}
        </span>
        {target.url ? (
          <a
            href={target.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate text-meta font-normal text-info underline-offset-2 hover:underline"
          >
            {sourceLabel(target.url)}
          </a>
        ) : null}
      </th>
      <td className="px-4 py-3.5">
        <Badge tone={failed ? 'warning' : isPaused ? 'neutral' : 'success'}>
          {failed ? 'Check failed' : isPaused ? 'Paused' : 'Active'}
        </Badge>
      </td>
      <td className="px-4 py-3.5 text-text-muted">
        {target.lastSuccessfulCheckAt ? (
          formatTimestamp(target.lastSuccessfulCheckAt)
        ) : (
          <span className="text-warning">No successful check yet</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-text-muted">{formatTimestamp(target.nextScheduledCheckAt)}</td>
      <td className="px-4 py-3.5">
        <span
          className={cn(
            'font-semibold tabular-nums',
            target.eventsDetected > 0 ? 'text-danger' : 'text-text-muted',
          )}
        >
          {target.eventsDetected}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More options for ${target.label}`}
                className="grid size-11 place-items-center rounded-button text-text-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <Ellipsis aria-hidden="true" className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Check frequency</DropdownMenuLabel>
              {(['hourly', 'daily', 'weekly'] as const).map((frequency) => (
                <DropdownMenuItem
                  key={frequency}
                  disabled={target.frequency === frequency}
                  onSelect={() => changeFrequency(frequency)}
                >
                  {FREQUENCY_LABEL[frequency]}
                </DropdownMenuItem>
              ))}
              {target.url ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      const url = target.url;
                      if (url) window.open(url, '_blank', 'noopener');
                    }}
                  >
                    Open the source
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            aria-label={isPaused ? `Resume monitoring ${target.label}` : `Pause monitoring ${target.label}`}
            disabled={updateTarget.isPending}
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
            className="grid size-11 place-items-center rounded-button text-text-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-55"
          >
            {isPaused ? (
              <Play aria-hidden="true" className="size-4" />
            ) : (
              <Pause aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Add a monitoring target.
 *
 * The URL is the source of truth: the student names a page the agent should
 * re-check, and the label defaults to its hostname so nothing is invented.
 */
function AddTargetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createTarget = useCreateMonitorTarget();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [frequency, setFrequency] = useState<MonitorFrequency>('daily');
  const [touched, setTouched] = useState(false);

  const labelValue = label.trim() || (url.trim() ? sourceLabel(url.trim()) : '');
  const urlError =
    touched && !url.trim()
      ? ['Enter the page you want monitored.']
      : touched && url.trim() && !/^https?:\/\/\S+\.\S+/.test(url.trim())
        ? ['Enter a full address, including https://']
        : undefined;
  const labelError = touched && !labelValue ? ['Name this target.'] : undefined;

  const submit = () => {
    setTouched(true);
    if (!url.trim() || !labelValue) return;

    createTarget.mutate(
      { targetType: 'url', url: url.trim(), label: labelValue, frequency },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Monitoring started', description: labelValue });
          setUrl('');
          setLabel('');
          setFrequency('daily');
          setTouched(false);
          onOpenChange(false);
        },
        onError: () =>
          toast({
            tone: 'error',
            title: 'We could not add that target',
            description: 'Nothing was changed. Try again.',
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a monitoring target</DialogTitle>
          <DialogDescription>
            Oppulse re-checks this page on a schedule and tells you when something meaningful changes.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field
            label="Page to watch"
            required
            errors={urlError}
            helperText="The official call or programme page."
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="url"
                inputMode="url"
                value={url}
                placeholder="https://…"
                onChange={(event) => setUrl(event.target.value)}
              />
            )}
          </Field>

          <Field label="Name this target" errors={labelError}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={label}
                placeholder={url.trim() ? sourceLabel(url.trim()) : 'Fully funded internships'}
                onChange={(event) => setLabel(event.target.value)}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text">How often</legend>
            <div className="flex flex-wrap gap-2 pt-1">
              {(['hourly', 'daily', 'weekly'] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-button border px-3 text-sm',
                    'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
                    frequency === option
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border bg-surface text-text hover:bg-surface-subtle',
                  )}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={option}
                    checked={frequency === option}
                    onChange={() => setFrequency(option)}
                    className="sr-only"
                  />
                  {FREQUENCY_LABEL[option]}
                </label>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createTarget.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createTarget.isPending} loadingLabel="Adding…">
              <CircleCheck aria-hidden="true" className="size-4" />
              Add target
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
