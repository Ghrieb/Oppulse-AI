import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileSearch,
  FlaskConical,
  GraduationCap,
  Library,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import { OpportunityRail } from './OpportunityRail';
import { OpportunityDetailPanel } from './OpportunityDetailPanel';
import { ActivityPanel } from './ActivityPanel';
import { SummaryPanels } from './SummaryPanels';
import { MissionStrip } from '@/components/actions/mission-strip';
import { NextBestAction } from '@/components/actions/next-best-action';
import { Card } from '@/components/ui/card';
import { OppulseMascot } from '@/components/agent/oppulse-mascot';
import { AgentComposer } from '@/components/agent/agent-composer';
import { AgentConversation } from '@/components/agent/agent-conversation';
import { ContextStrip } from '@/components/agent/context-strip';
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
 * The five starting points on the home workspace.
 *
 * Each one is a real request the agent can act on, chosen so the student
 * never faces an empty composer without a next step.
 */
const QUICK_ACTIONS: { id: string; label: string; icon: LucideIcon; tone: string; message: string }[] =
  [
    {
      id: 'scholarships',
      label: 'Find scholarships for me',
      icon: GraduationCap,
      tone: 'bg-primary/10 text-primary',
      message: 'Find fully funded scholarships suited to me.',
    },
    {
      id: 'masters',
      label: 'Explore Master’s programs',
      icon: Library,
      tone: 'bg-info/10 text-info',
      message: 'Explore Master’s programmes I am eligible for.',
    },
    {
      id: 'internships',
      label: 'Find research internships',
      icon: FlaskConical,
      tone: 'bg-success/10 text-success',
      message: 'Find research internships for me.',
    },
    {
      id: 'analyse',
      label: 'Analyze a scholarship call',
      icon: FileSearch,
      tone: 'bg-warning/12 text-warning',
      message: 'Analyse this scholarship call:',
    },
    {
      id: 'prepare',
      label: 'Help me prepare an application',
      icon: PenLine,
      tone: 'bg-info/10 text-info',
      message: 'Help me prepare an application.',
    },
  ];

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
        <img
          src="/brand/workspace-banner.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-24 hidden h-[130%] w-auto opacity-45 select-none xl:block"
        />
        <div className="pointer-events-none absolute top-5 right-6 hidden xl:block">
          <span className="block -rotate-6 font-medium text-[#4b6bfb] italic">
            <span className="block text-lg">Big goals,</span>
            <span className="mt-1 block text-lg">Real opportunities</span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 120 24"
            className="mt-1 h-4 w-28 text-[#4b6bfb]"
            fill="none"
          >
            <path
              d="M4 16c18-8 38-11 58-9 16 1 32 5 54 12"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
          <OppulseMascot
            size="hero"
            label="Oppulse, your academic opportunity agent"
            className="hidden shrink-0 sm:block"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-meta font-semibold tracking-[0.14em] text-primary uppercase">
              Your research workspace
            </p>
            <h1 className="text-page-title font-semibold tracking-tight text-text">
              Hi {firstName}!
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-text-muted">
              I’m Oppulse, your AI research partner. I’ll help you find scholarships, explore study
              programmes, check your eligibility and guide you through the application process.
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <AgentComposer
            onSend={send}
            pending={pending}
            placeholder="What opportunity are we looking for today?"
            contextSlot={<ContextStrip />}
          />
        </div>

        <div className="relative mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={pending}
                onClick={() => void send(action.message)}
                className="flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 text-left shadow-[0_1px_2px_0_rgb(11_23_48/0.04)] transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-55"
              >
                <span
                  aria-hidden="true"
                  className={`grid size-9 shrink-0 place-items-center rounded-button ${action.tone}`}
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="text-sm leading-snug font-medium text-text">{action.label}</span>
              </button>
            );
          })}
        </div>

        {messages.length > 0 ? (
          <div className="relative mt-5 max-w-3xl rounded-panel border border-white/80 bg-white/70 p-4">
            <AgentConversation />
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
      </div>

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
