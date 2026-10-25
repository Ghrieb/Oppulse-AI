import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, PauseCircle, Play, PlayCircle, Plus, Target, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/tooltip';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import { RunStatusBadge, RunTimeline } from '@/components/agent/run-timeline';
import { useToast } from '@/lib/hooks/use-toast';
import {
  useCancelRun,
  useMissions,
  usePauseRun,
  useResumeRun,
  useRun,
  useRunEvents,
  useStartRun,
  useUpdateMission,
} from '@/lib/queries';
import type { Mission } from '@/lib/schemas';

/**
 * Goals — the mission workspace.
 *
 * A mission is the student's own words plus the structured criteria the
 * agent derived from them. The structured summary is always editable.
 */
export function GoalsPage() {
  const { data, isPending, error, refetch } = useMissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="My goals" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const missions = data?.missions ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My goals"
        description="Each mission tells the agent what to look for. Save one and the agent keeps checking it for changes."
        actions={
          <Button size="sm">
            <Plus aria-hidden="true" className="size-4" />
            New mission
          </Button>
        }
      />

      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      ) : missions.length === 0 ? (
        <EmptyState
          icon={<Target className="size-5" />}
          title="No missions yet"
          description="Describe what you are looking for — a fully funded research internship, a scholarship for your field — and the agent will build the search plan from your own words."
          action={
            <Button size="sm">
              <Plus aria-hidden="true" className="size-4" />
              Create your first mission
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onSelect={() => setSelectedId(mission.id)}
            />
          ))}
        </div>
      )}

      {selectedId ? (
        <MissionDetail missionId={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}

function MissionCard({ mission, onSelect }: { mission: Mission; onSelect: () => void }) {
  const updateMission = useUpdateMission();
  const startRun = useStartRun();
  const pauseRun = usePauseRun();
  const resumeRun = useResumeRun();
  const cancelRun = useCancelRun();
  const { data: run } = useRun(mission.latestRunId ?? null);
  const { toast } = useToast();
  const isActive = mission.status === 'active';
  const runActive = run?.status === 'running' || run?.status === 'queued';
  const runControllable =
    run != null && (run.status === 'running' || run.status === 'queued' || run.status === 'paused');

  // The run exists before `latestRunId` catches up, so the button stays
  // busy across the gap — a second click there would queue a second run.
  const runKey = run ? `${run.id}:${run.status}` : '';
  const [lastRunKey, setLastRunKey] = useState(runKey);
  const [runStarting, setRunStarting] = useState(false);
  if (runKey !== lastRunKey) {
    setLastRunKey(runKey);
    setRunStarting(false);
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-card-title font-semibold text-text">{mission.title}</h2>
        <Badge tone={isActive ? 'success' : mission.status === 'paused' ? 'warning' : 'neutral'}>
          {mission.status === 'active'
            ? 'Active'
            : mission.status === 'paused'
              ? 'Paused'
              : mission.status === 'draft'
                ? 'Draft'
                : mission.status}
        </Badge>
      </div>

      <p className="line-clamp-3 text-sm text-text-muted">{mission.objective}</p>

      <div className="flex flex-wrap gap-1.5">
        {mission.criteria.academicInterests.map((interest) => (
          <Badge key={interest} tone="neutral">
            {interest}
          </Badge>
        ))}
        {mission.criteria.destinations.map((destination) => (
          <Badge key={destination} tone="info">
            {destination}
          </Badge>
        ))}
        <Badge tone="primary">
          {mission.criteria.fundingPreference === 'fully_funded'
            ? 'Fully funded only'
            : mission.criteria.fundingPreference === 'partial_ok'
              ? 'Partial funding ok'
              : 'Any funding'}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={onSelect}>
          Open mission
        </Button>
        <Button
          variant="outline"
          size="sm"
          loading={startRun.isPending || runStarting}
          loadingLabel="Starting run…"
          disabled={runActive}
          disabledReason={runActive ? 'A research run is already in progress.' : undefined}
          onClick={() => {
            if (startRun.isPending || runStarting) return;
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
        >
          <PlayCircle aria-hidden="true" className="size-4" />
          Run research
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={updateMission.isPending}
          loadingLabel={isActive ? 'Pausing mission…' : 'Resuming mission…'}
          onClick={() =>
            updateMission.mutate(
              { id: mission.id, status: isActive ? 'paused' : 'active' },
              {
                onSuccess: () =>
                  toast({
                    tone: 'success',
                    title: isActive ? 'Mission paused' : 'Mission resumed',
                  }),
              },
            )
          }
        >
          {isActive ? (
            <>
              <Pause aria-hidden="true" className="size-4" />
              Pause
            </>
          ) : (
            <>
              <Play aria-hidden="true" className="size-4" />
              Resume
            </>
          )}
        </Button>
        {run && (run.status === 'running' || run.status === 'queued') ? (
          <Button
            variant="outline"
            size="sm"
            loading={pauseRun.isPending}
            loadingLabel="Pausing run…"
            onClick={() =>
              pauseRun.mutate(run.id, {
                onSuccess: () =>
                  toast({
                    tone: 'success',
                    title: 'Run paused',
                    description: 'It continues from its next checkpoint.',
                  }),
                onError: () =>
                  toast({
                    tone: 'error',
                    title: 'We could not pause the run',
                    description: 'Nothing changed. Try again.',
                  }),
              })
            }
          >
            <PauseCircle aria-hidden="true" className="size-4" />
            Pause run
          </Button>
        ) : null}
        {run?.status === 'paused' ? (
          <Button
            variant="outline"
            size="sm"
            loading={resumeRun.isPending}
            loadingLabel="Resuming run…"
            onClick={() =>
              resumeRun.mutate(run.id, {
                onSuccess: () => toast({ tone: 'success', title: 'Run resumed' }),
                onError: () =>
                  toast({
                    tone: 'error',
                    title: 'We could not resume the run',
                    description: 'Nothing changed. Try again.',
                  }),
              })
            }
          >
            <PlayCircle aria-hidden="true" className="size-4" />
            Resume run
          </Button>
        ) : null}
        {runControllable ? (
          <Button
            variant="danger"
            size="sm"
            loading={cancelRun.isPending}
            loadingLabel="Cancelling run…"
            onClick={() =>
              cancelRun.mutate(run.id, {
                onSuccess: () =>
                  toast({
                    tone: 'info',
                    title: 'Run cancelled',
                    description: 'Nothing further was searched.',
                  }),
                onError: () =>
                  toast({
                    tone: 'error',
                    title: 'We could not cancel the run',
                    description: 'Nothing changed. Try again.',
                  }),
              })
            }
          >
            <XCircle aria-hidden="true" className="size-4" />
            Cancel run
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function MissionDetail({ missionId, onClose }: { missionId: string; onClose: () => void }) {
  const { data: mission } = useMissions();
  const current = mission?.missions.find((item) => item.id === missionId);
  const { data: run } = useRun(current?.latestRunId ?? null);
  const { data: eventData } = useRunEvents(current?.latestRunId ?? null);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-card-title font-semibold text-text">{current?.title}</h2>
          <p className="text-sm text-text-muted">{current?.objective}</p>
        </div>
        <div className="flex items-center gap-2">
          {run ? <RunStatusBadge status={run.status} /> : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <Tabs defaultValue="criteria">
        <TabsList>
          <TabsTrigger value="criteria">Structured criteria</TabsTrigger>
          <TabsTrigger value="run">Latest run</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="criteria" className="pt-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Opportunity types">
              {current?.criteria.opportunityTypes.join(', ') || 'Not specified'}
            </Detail>
            <Detail label="Academic interests">
              {current?.criteria.academicInterests.join(', ') || 'Not specified'}
            </Detail>
            <Detail label="Destinations">
              {current?.criteria.destinations.join(', ') || 'Global'}
            </Detail>
            <Detail label="Education level">{current?.criteria.educationLevel}</Detail>
            <Detail label="Funding preference">{current?.criteria.fundingPreference}</Detail>
            <Detail label="Start period">{current?.criteria.startPeriod || 'Not specified'}</Detail>
            <Detail label="Source scope">
              {current?.criteria.sourceScope.join(', ') || 'Not specified'}
            </Detail>
            <Detail label="Uses my confirmed profile">
              {current?.criteria.useProfile ? 'Yes' : 'No'}
            </Detail>
          </dl>
        </TabsContent>

        <TabsContent value="run" className="pt-4">
          {run ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                <span>{run.budgetUsed.modelCalls} model calls</span>
                <span>{run.budgetUsed.searchCalls} searches</span>
                <span>{run.budgetUsed.fetchedSources} sources fetched</span>
                {run.summary ? (
                  <span>
                    {run.summary.sourcesReviewed} sources reviewed · {run.summary.candidatesFound}{' '}
                    candidates
                  </span>
                ) : null}
              </div>
              <RunTimeline events={eventData?.events ?? []} />
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              This mission has not been run yet. Press “Run research” to start a bounded run.
            </p>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="pt-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">
              {current?.monitoring.enabled
                ? `Checked ${current.monitoring.frequency}. The UI shows the last successful check, never a live promise.`
                : 'Monitoring is off for this mission.'}
            </p>
            <Button asChild variant="outline" size="sm" className="self-start">
              <Link to="/monitoring">Open monitoring</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta font-medium text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}
