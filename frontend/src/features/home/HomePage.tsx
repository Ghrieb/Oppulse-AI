import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Target, UserPlus } from 'lucide-react';
import { OpportunityRail } from './OpportunityRail';
import { OpportunityDetailPanel } from './OpportunityDetailPanel';
import { ActivityPanel } from './ActivityPanel';
import { SummaryPanels } from './SummaryPanels';
import { MissionStrip } from '@/components/actions/mission-strip';
import { NextBestAction } from '@/components/actions/next-best-action';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OppulseAvatar } from '@/components/agent/oppulse-avatar';
import { ActionChips } from '@/components/agent/action-chips';
import { AgentComposer } from '@/components/agent/agent-composer';
import { AgentConversation } from '@/components/agent/agent-conversation';
import { useAgent } from '@/lib/agent-context';
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
  const { send, pending, messages } = useAgent();
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
      <section className="relative overflow-hidden rounded-panel border border-primary/15 bg-gradient-to-br from-[#edf2ff] via-surface to-[#eef9ff] px-5 py-6 shadow-[0_18px_50px_-36px_rgb(47_115_201/0.55)] sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-10 -bottom-16 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-center">
          <div className="flex items-start gap-4">
            <OppulseAvatar
              size="lg"
              className="mt-1 shadow-[0_10px_24px_-12px_rgb(91_75_242/0.7)]"
            />
            <div className="flex flex-col gap-2">
              <p className="text-meta font-semibold tracking-[0.14em] text-primary uppercase">
                Your research workspace
              </p>
              <h1 className="text-page-title font-semibold tracking-tight text-text">
                Hi {firstName}!
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-text-muted">
                I’m Oppulse, your opportunity agent. I’ll help you find scholarships, explore
                programmes, check your eligibility and turn the right ones into applications.
              </p>
            </div>
          </div>
          <div className="rounded-panel border border-white/80 bg-white/75 p-3 shadow-[0_8px_24px_-20px_rgb(11_23_48/0.5)] backdrop-blur-sm">
            <AgentComposer
              onSend={send}
              pending={pending}
              placeholder="What opportunity are we looking for today?"
            />
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void send('Find fully funded opportunities suited to me.')}
          >
            <Target aria-hidden="true" className="size-4 text-primary" />
            Find opportunities for me
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void send('Analyse this opportunity link:')}
          >
            <Link2 aria-hidden="true" className="size-4 text-info" />
            Analyse a link
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void send('Help me prepare an application.')}
          >
            <UserPlus aria-hidden="true" className="size-4 text-success" />
            Prepare an application
          </Button>
          <ActionChips />
        </div>
        {messages.length > 0 ? (
          <div className="relative mt-5 max-w-3xl rounded-panel border border-white/80 bg-white/70 p-4">
            <AgentConversation />
          </div>
        ) : null}
      </section>

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

      <div
        className={
          isClosed
            ? 'grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]'
            : 'grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]'
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <OpportunityRail selectedId={activeId} onSelect={selectOpportunity} />
        </div>
        {isClosed ? (
          <Card className="hidden min-h-40 items-center justify-center p-6 text-center text-sm text-text-muted xl:flex">
            Select an opportunity to see its evidence and next actions here.
          </Card>
        ) : (
          <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <OpportunityDetailPanel opportunityId={activeId} onClose={closePanel} />
          </div>
        )}
      </div>

      <ActivityPanel runId={mission?.latestRunId ?? null} />

      <SummaryPanels />
    </div>
  );
}
