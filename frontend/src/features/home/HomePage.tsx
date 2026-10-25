import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { AgentPanel } from './AgentPanel';
import { OpportunityRail } from './OpportunityRail';
import { OpportunityDetailPanel } from './OpportunityDetailPanel';
import { ActivityPanel } from './ActivityPanel';
import { SummaryPanels } from './SummaryPanels';
import { MissionStrip } from '@/components/actions/mission-strip';
import { NextBestAction } from '@/components/actions/next-best-action';
import { useToast } from '@/lib/hooks/use-toast';
import {
  useCancelRun,
  useMissions,
  useMonitorTargets,
  useNextAction,
  useOpportunities,
  usePauseRun,
  useResumeRun,
  useRun,
  useSession,
  useStartRun,
} from '@/lib/queries';

/**
 * Home — the workspace.
 *
 * The order is deliberate: what Oppulse is working on, what you should do
 * next, then the agent, then the results. The workspace exists to help the
 * student act, not to display everything the database holds.
 */
export function HomePage() {
  const { data: session } = useSession();
  const { data: opportunities } = useOpportunities();
  const { data: missions } = useMissions();
  const { data: monitorTargets } = useMonitorTargets();
  const { data: nextAction } = useNextAction();
  const startRun = useStartRun();
  const pauseRun = usePauseRun();
  const resumeRun = useResumeRun();
  const cancelRun = useCancelRun();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selection lives in the URL: it survives a refresh, it is shareable, and
  // the chat can open the panel by linking here. `panel=closed` is an
  // explicit close, so the panel never reopens itself over the student's
  // choice, and a selected opportunity is never silently replaced.
  const isClosed = searchParams.get('panel') === 'closed';
  const explicitId = searchParams.get('opportunity');
  const activeId = isClosed ? null : (explicitId ?? opportunities?.opportunities[0]?.id ?? null);

  const selectOpportunity = (id: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('opportunity', id);
        next.delete('panel');
        return next;
      },
      { replace: true },
    );
  };

  const closePanel = () => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('opportunity');
        next.set('panel', 'closed');
        return next;
      },
      { replace: true },
    );
  };

  const mission =
    missions?.missions.find((item) => item.status === 'active') ?? missions?.missions[0];
  const { data: run } = useRun(mission?.latestRunId ?? null);

  // The run exists before `latestRunId` catches up, so the strip stays busy
  // across the gap — a second click there would queue a second run. The
  // latch clears when the run data itself moves on.
  const runKey = run ? `${run.id}:${run.status}` : '';
  const [lastRunKey, setLastRunKey] = useState(runKey);
  const [runStarting, setRunStarting] = useState(false);
  if (runKey !== lastRunKey) {
    setLastRunKey(runKey);
    setRunStarting(false);
  }

  const monitorTarget =
    monitorTargets?.targets.find(
      (target) => target.targetType === 'mission' && target.targetId === mission?.id,
    ) ?? null;

  const firstName = session?.user.fullName.split(' ')[0] ?? 'there';

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-page-title font-semibold tracking-tight text-text">
          <Bot aria-hidden="true" className="size-7 text-primary" />
          Hi {firstName}!
        </h1>
        <p className="max-w-3xl text-sm text-text-muted">
          Research opportunities, check them against your confirmed profile, and turn the promising
          ones into an application plan. Everything below is grounded in retrieved sources.
        </p>
      </header>

      <MissionStrip
        mission={mission}
        run={run}
        monitorTarget={monitorTarget}
        runPending={startRun.isPending || runStarting}
        runControlPending={
          pauseRun.isPending
            ? 'pause'
            : resumeRun.isPending
              ? 'resume'
              : cancelRun.isPending
                ? 'cancel'
                : null
        }
        onPauseRun={
          run && (run.status === 'running' || run.status === 'queued')
            ? () =>
                pauseRun.mutate(run.id, {
                  onError: () =>
                    toast({
                      tone: 'error',
                      title: 'We could not pause the run',
                      description: 'Nothing changed. Try again.',
                    }),
                })
            : undefined
        }
        onResumeRun={
          run?.status === 'paused'
            ? () =>
                resumeRun.mutate(run.id, {
                  onError: () =>
                    toast({
                      tone: 'error',
                      title: 'We could not resume the run',
                      description: 'Nothing changed. Try again.',
                    }),
                })
            : undefined
        }
        onCancelRun={
          run && (run.status === 'running' || run.status === 'queued' || run.status === 'paused')
            ? () =>
                cancelRun.mutate(run.id, {
                  onSuccess: () =>
                    toast({
                      tone: 'info',
                      title: 'Run cancelled',
                      description: 'Nothing further was searched. Run research again any time.',
                    }),
                  onError: () =>
                    toast({
                      tone: 'error',
                      title: 'We could not cancel the run',
                      description: 'Nothing changed. Try again.',
                    }),
                })
            : undefined
        }
        onRun={() => {
          if (!mission || startRun.isPending || runStarting) return;
          setRunStarting(true);
          startRun.mutate(mission.id, {
            onSuccess: () =>
              toast({
                tone: 'info',
                title: 'Research started',
                description: 'Progress events will appear as the agent works.',
              }),
            onError: () => {
              setRunStarting(false);
              toast({
                tone: 'error',
                title: 'We could not start the research run',
                description: 'Nothing was queued. Try again in a moment.',
              });
            },
          });
        }}
      />

      <NextBestAction action={nextAction?.action} />

      <div className={isClosed ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4 xl:grid-cols-3'}>
        <AgentPanel />
        <OpportunityRail selectedId={activeId} onSelect={selectOpportunity} />
        {isClosed ? null : <OpportunityDetailPanel opportunityId={activeId} onClose={closePanel} />}
      </div>

      <ActivityPanel runId={mission?.latestRunId ?? null} />

      <SummaryPanels />
    </div>
  );
}
