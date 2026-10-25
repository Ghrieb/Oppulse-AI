import { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Globe,
  ListChecks,
  ScrollText,
  Search,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { RunEvent, RunEventType } from '@/lib/schemas';

/**
 * Run timeline.
 *
 * Shows factual execution events — what was retrieved, what failed, what
 * was extracted. It never shows fabricated internal reasoning (spec §6.3).
 */

const EVENT_META: Record<
  RunEventType,
  {
    label: string;
    Icon: typeof Search;
    tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  }
> = {
  'run.queued': { label: 'Queued', Icon: ListChecks, tone: 'neutral' },
  'run.started': { label: 'Started', Icon: Search, tone: 'info' },
  'run.paused': { label: 'Paused', Icon: XCircle, tone: 'warning' },
  'run.resumed': { label: 'Resumed', Icon: Search, tone: 'info' },
  'run.retried': { label: 'Retried', Icon: ListChecks, tone: 'info' },
  'understanding.started': { label: 'Understanding', Icon: FileSearch, tone: 'info' },
  'understanding.completed': { label: 'Plan ready', Icon: CheckCircle2, tone: 'success' },
  'search.started': { label: 'Searching', Icon: Search, tone: 'info' },
  'search.completed': { label: 'Search complete', Icon: CheckCircle2, tone: 'success' },
  'source.retrieved': { label: 'Source retrieved', Icon: Globe, tone: 'success' },
  'source.unavailable': { label: 'Source unavailable', Icon: AlertTriangle, tone: 'warning' },
  'requirements.extracted': { label: 'Requirements extracted', Icon: ScrollText, tone: 'info' },
  'eligibility.evaluated': { label: 'Eligibility checked', Icon: ListChecks, tone: 'info' },
  'deadline.extracted': { label: 'Deadline extracted', Icon: ScrollText, tone: 'info' },
  'funding.assessed': { label: 'Funding assessed', Icon: ScrollText, tone: 'info' },
  'opportunity.saved': { label: 'Opportunity saved', Icon: CheckCircle2, tone: 'success' },
  'profile.needs_confirmation': {
    label: 'Needs confirmation',
    Icon: AlertTriangle,
    tone: 'warning',
  },
  'provider.warning': { label: 'Provider warning', Icon: AlertTriangle, tone: 'warning' },
  'run.completed': { label: 'Completed', Icon: CheckCircle2, tone: 'success' },
  'run.partial': { label: 'Partial result', Icon: AlertTriangle, tone: 'warning' },
  'run.failed': { label: 'Failed', Icon: XCircle, tone: 'danger' },
  'run.cancelled': { label: 'Cancelled', Icon: XCircle, tone: 'neutral' },
};

const TONE_CLASS = {
  neutral: 'border-border bg-surface-subtle text-text-muted',
  success: 'border-success/25 bg-success-surface text-success',
  warning: 'border-warning/25 bg-warning-surface text-warning',
  danger: 'border-danger/25 bg-danger-surface text-danger',
  info: 'border-info/25 bg-info/10 text-info',
} as const;

export function RunTimeline({ events, className }: { events: RunEvent[]; className?: string }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        The run is queued. Progress events will appear here as the agent works.
      </p>
    );
  }

  return (
    <ol className={cn('flex flex-col gap-2', className)}>
      {events.map((event) => {
        const meta = EVENT_META[event.type];
        const Icon = meta.Icon;
        return (
          <li key={event.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border',
                TONE_CLASS[meta.tone],
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm text-text">{event.message}</span>
              <span className="text-meta text-text-muted">
                {meta.label} ·{' '}
                {new Date(event.createdAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </li>
        );
      })}
      <div ref={endRef} />
    </ol>
  );
}

export function RunStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'success'
      : status === 'failed'
        ? 'danger'
        : status === 'partial' || status === 'paused'
          ? 'warning'
          : status === 'running' || status === 'queued'
            ? 'info'
            : 'neutral';

  const label: Record<string, string> = {
    queued: 'Queued',
    running: 'Researching',
    waiting_for_input: 'Waiting for you',
    paused: 'Research paused',
    completed: 'Research completed',
    partial: 'Partial result',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  return <Badge tone={tone}>{label[status] ?? status}</Badge>;
}
