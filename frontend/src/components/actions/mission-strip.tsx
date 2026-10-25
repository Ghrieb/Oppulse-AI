import { Link } from 'react-router-dom';
import {
  BellRing,
  CalendarClock,
  History,
  PauseCircle,
  Play,
  PlayCircle,
  Radio,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RunStatusBadge } from '@/components/agent/run-timeline';
import type { AgentRun, Mission, MonitorTarget } from '@/lib/schemas';

/** Which run control, if any, is waiting on the server. */
export type RunControlPending = 'pause' | 'resume' | 'cancel' | null | undefined;

/**
 * Active mission strip.
 *
 * The first thing on the home workspace: what Oppulse is working on, when it
 * last looked, and when it will look next. It answers "is anything
 * happening?" without scrolling. A run in flight can be paused, resumed or
 * cancelled from here — the student always keeps the stop button.
 */
export function MissionStrip({
  mission,
  run,
  monitorTarget,
  onRun,
  runPending = false,
  onPauseRun,
  onResumeRun,
  onCancelRun,
  runControlPending,
  className,
}: {
  mission: Mission | null | undefined;
  run: AgentRun | null | undefined;
  monitorTarget: MonitorTarget | null | undefined;
  onRun?: () => void;
  runPending?: boolean | undefined;
  onPauseRun?: (() => void) | undefined;
  onResumeRun?: (() => void) | undefined;
  onCancelRun?: (() => void) | undefined;
  runControlPending?: RunControlPending;
  className?: string | undefined;
}) {
  if (!mission) {
    return (
      <Card className={className}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-text-muted">
            No mission yet. Tell Oppulse what you are looking for and it will build one.
          </p>
          <Button asChild size="sm">
            <Link to="/goals">
              <Play aria-hidden="true" className="size-4" />
              Create a mission
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  const isRunning = run?.status === 'running' || run?.status === 'queued';

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-meta font-medium text-text-muted">Active mission</span>
          <span className="line-clamp-2 text-card-title font-semibold text-text">
            {mission.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {run ? <RunStatusBadge status={run.status} /> : null}

          <span className="inline-flex items-center gap-1.5 text-meta text-text-muted">
            <History aria-hidden="true" className="size-3.5" />
            {run
              ? `Last run ${new Date(run.startedAt).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Never run'}
          </span>

          {monitorTarget?.nextScheduledCheckAt ? (
            <span className="inline-flex items-center gap-1.5 text-meta text-text-muted">
              <CalendarClock aria-hidden="true" className="size-3.5" />
              Next check{' '}
              {new Date(monitorTarget.nextScheduledCheckAt).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-meta text-text-muted">
              <Radio aria-hidden="true" className="size-3.5" />
              Monitoring not scheduled
            </span>
          )}

          {monitorTarget?.status === 'active' ? (
            <Badge tone="success" icon={<BellRing />}>
              Monitoring on
            </Badge>
          ) : null}

          {onRun && !isRunning && run?.status !== 'paused' ? (
            <Button size="sm" loading={runPending} loadingLabel="Starting run…" onClick={onRun}>
              <Play aria-hidden="true" className="size-4" />
              Run research
            </Button>
          ) : null}

          {onPauseRun && (run?.status === 'running' || run?.status === 'queued') ? (
            <Button
              variant="outline"
              size="sm"
              loading={runControlPending === 'pause'}
              loadingLabel="Pausing…"
              onClick={onPauseRun}
            >
              <PauseCircle aria-hidden="true" className="size-4" />
              Pause
            </Button>
          ) : null}

          {onResumeRun && run?.status === 'paused' ? (
            <Button
              variant="outline"
              size="sm"
              loading={runControlPending === 'resume'}
              loadingLabel="Resuming…"
              onClick={onResumeRun}
            >
              <PlayCircle aria-hidden="true" className="size-4" />
              Resume
            </Button>
          ) : null}

          {onCancelRun && (isRunning || run?.status === 'paused') ? (
            <Button
              variant="danger"
              size="sm"
              loading={runControlPending === 'cancel'}
              loadingLabel="Cancelling…"
              onClick={onCancelRun}
            >
              <XCircle aria-hidden="true" className="size-4" />
              Cancel run
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
