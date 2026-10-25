import { useNavigate } from 'react-router-dom';
import { FlaskConical, Radio, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/controls';
import { cn } from '@/lib/cn';
import { IS_MOCK_MODE, PRODUCT_MODE } from '@/lib/api/config';
import { useCapabilityStatus } from '@/lib/hooks/use-capability-status';
import { useMissions, useRun } from '@/lib/queries';
import type { Capability } from '@/lib/schemas';

const CAPABILITY_BADGE: Record<
  Capability['mode'],
  { label: string; tone: 'success' | 'info' | 'neutral' }
> = {
  live: { label: 'Live', tone: 'success' },
  mocked: { label: 'Simulated', tone: 'info' },
  unavailable: { label: 'Not configured', tone: 'neutral' },
};

const RUN_LABELS: Record<string, string> = {
  queued: 'Research queued',
  running: 'Agent is researching',
  waiting_for_input: 'Agent needs your input',
  paused: 'Research paused',
};

const TERMINAL_RUN_STATES = new Set(['completed', 'partial', 'failed', 'cancelled']);

/**
 * Connection indicator.
 *
 * One honest pill in the shell: which API the app is talking to, and — on
 * request — what each capability actually is right now. It reports; it never
 * switches modes.
 */
export function ConnectionIndicator() {
  const { data, isPending } = useCapabilityStatus();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-meta font-medium',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            IS_MOCK_MODE
              ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15'
              : 'border-success/30 bg-success-surface text-success hover:bg-success/10',
          )}
        >
          {IS_MOCK_MODE ? (
            <FlaskConical aria-hidden="true" className="size-3.5" />
          ) : (
            <Wifi aria-hidden="true" className="size-3.5" />
          )}
          {IS_MOCK_MODE ? 'Demo data' : 'Live API'}
          <span className="sr-only">Open connection status</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>Connection status</span>
          <span className="text-meta font-normal text-text-muted">
            API connection: {IS_MOCK_MODE ? 'mock' : 'live'} · Product mode: {PRODUCT_MODE}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isPending || !data ? (
          <p className="px-3 py-2 text-meta text-text-muted">Checking capabilities…</p>
        ) : (
          <ul className="flex flex-col gap-2 p-3">
            {data.capabilities.map((capability) => {
              const badge = CAPABILITY_BADGE[capability.mode];
              return (
                <li key={capability.key} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">{capability.label}</span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className="text-meta text-text-muted">{capability.detail}</p>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Capability banner.
 *
 * In Student Testing mode this replaces the generic synthetic-data banner:
 * per-service status instead of one blanket claim.
 */
export function CapabilityBanner({ className }: { className?: string }) {
  const { data, isPending } = useCapabilityStatus();

  if (PRODUCT_MODE !== 'student_testing' || isPending || !data) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface-subtle px-4 py-2 text-meta text-text-muted',
        className,
      )}
    >
      <span className="font-semibold text-text">Student testing</span>
      {data.capabilities.map((capability) => {
        const badge = CAPABILITY_BADGE[capability.mode];
        return (
          <span key={capability.key} className="inline-flex items-center gap-1.5">
            <span>{capability.label}:</span>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </span>
        );
      })}
    </div>
  );
}

/** Small inline status pill used in the top bar while a run is in flight. */
export function RunStatusPill({ status, onClick }: { status: string; onClick?: () => void }) {
  const label = RUN_LABELS[status] ?? status;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 text-meta font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <Radio aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}

/**
 * The active run, surfaced in the shell.
 *
 * The student should always be able to see that research is in flight and
 * get back to it, from any route — not only from the home workspace.
 */
export function ActiveRunPill() {
  const navigate = useNavigate();
  const { data: missions } = useMissions();
  const mission =
    missions?.missions.find((item) => item.status === 'active') ?? missions?.missions[0] ?? null;
  const { data: run } = useRun(mission?.latestRunId ?? null);

  if (!run || TERMINAL_RUN_STATES.has(run.status)) return null;

  return <RunStatusPill status={run.status} onClick={() => navigate('/goals')} />;
}
