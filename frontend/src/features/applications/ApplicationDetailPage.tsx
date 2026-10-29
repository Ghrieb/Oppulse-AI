import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  Circle,
  CircleCheck,
  ExternalLink,
  FileText,
  ListTodo,
  MessageSquareText,
  PenLine,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScoreRing } from '@/components/ui/display';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/tooltip';
import { ErrorState, NotFoundState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import { DraftActions } from '@/components/applications/draft-actions';
import { ApiError } from '@/lib/api/errors';
import { useAgent } from '@/lib/agent-context';
import { cn } from '@/lib/cn';
import { useApplication, useDocuments, useDrafts, useOpportunity } from '@/lib/queries';
import type { ChecklistItem, Document, Task } from '@/lib/schemas';
import { FUNDING_COVERAGE_LABEL, OPPORTUNITY_TYPE_LABEL } from '@/lib/opportunity-labels';
import { STATUS_LABEL, STATUS_TONE } from './status';

const CHECKLIST_LABEL: Record<ChecklistItem['status'], string> = {
  missing: 'Missing',
  ready: 'Ready',
  needs_attention: 'Needs attention',
  done: 'Done',
};

const CHECKLIST_TONE: Record<ChecklistItem['status'], 'neutral' | 'success' | 'warning' | 'info'> =
  {
    missing: 'neutral',
    ready: 'info',
    needs_attention: 'warning',
    done: 'success',
  };

const CHECKLIST_ICON: Record<ChecklistItem['status'], LucideIcon> = {
  missing: Circle,
  ready: Check,
  needs_attention: AlertTriangle,
  done: CircleCheck,
};

const CHECKLIST_ICON_TONE: Record<ChecklistItem['status'], string> = {
  missing: 'text-text-muted',
  ready: 'text-info',
  needs_attention: 'text-warning',
  done: 'text-success',
};

const DOC_STATUS_TONE: Record<
  Document['status'],
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  awaiting_upload: 'warning',
  uploaded: 'neutral',
  processing: 'info',
  needs_review: 'warning',
  processed: 'success',
  partial: 'warning',
  failed: 'danger',
  deleted: 'neutral',
};

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleDateString('en-GB', options ?? { dateStyle: 'medium' });
}

/**
 * One application workspace.
 *
 * The screen is organised around finishing the application: a completion
 * ring derived from real checklist items, the requirements themselves as
 * the primary column, and the supporting tasks, documents and drafts one
 * tab away. The right rail keeps the next action, the dated deadlines and
 * the agent within reach without scrolling (spec §4.4, §A.1).
 */
export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setContext } = useAgent();
  const { data: application, isPending, error, refetch } = useApplication(id ?? null);
  const { data: drafts } = useDrafts(application?.id ?? null);
  const { data: opportunityDetail } = useOpportunity(application?.opportunityId ?? null);
  const { data: documents } = useDocuments();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Application" />
        {error instanceof ApiError && error.code === 'NOT_FOUND' ? (
          <NotFoundState />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const opportunity = opportunityDetail?.opportunity ?? null;
  const match = opportunityDetail?.match ?? null;
  const percent =
    application.completion.total > 0
      ? Math.round((application.completion.completed / application.completion.total) * 100)
      : 0;

  const askOppulse = () => {
    setContext({ applicationId: application.id });
    void navigate('/assistant');
  };

  const openDocuments = application.checklist
    .map((item) => item.documentId)
    .filter((documentId): documentId is string => documentId !== null);
  const linkedDocuments = (documents?.documents ?? []).filter((document) =>
    openDocuments.includes(document.id),
  );

  const upcomingTasks = application.tasks
    .filter((task): task is Task & { dueDate: string } => Boolean(task.dueDate) && task.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/applications">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Applications
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Close this workspace and return to applications"
        >
          <Link to="/applications">
            <X aria-hidden="true" className="size-5" />
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-[0_1px_2px_0_rgb(11_23_48/0.04)] sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[application.status]}>{STATUS_LABEL[application.status]}</Badge>
            {application.deadlineVerified && application.deadline ? (
              <Badge tone="success">
                <CalendarClock aria-hidden="true" className="size-3" />
                Deadline {formatDate(application.deadline, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Badge>
            ) : (
              <Badge tone="warning">
                <CalendarClock aria-hidden="true" className="size-3" />
                Deadline not verified
              </Badge>
            )}
          </div>

          <h1 className="text-page-title font-semibold tracking-tight text-text">
            {application.opportunityTitle}
          </h1>
          <p className="text-sm text-text-muted">{application.institution}</p>

          <ul className="mt-1 flex flex-wrap items-center gap-1.5">
            {opportunity ? (
              <MetaChip>{opportunity.country.name}</MetaChip>
            ) : null}
            {opportunity ? <MetaChip>{OPPORTUNITY_TYPE_LABEL[opportunity.type]}</MetaChip> : null}
            {opportunity?.duration ? <MetaChip>{opportunity.duration}</MetaChip> : null}
            {opportunity ? (
              <MetaChip
                tone={
                  opportunity.funding.coverage === 'fully_funded'
                    ? 'success'
                    : opportunity.funding.coverage === 'unknown'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {FUNDING_COVERAGE_LABEL[opportunity.funding.coverage]}
              </MetaChip>
            ) : null}
            {match ? (
              <MetaChip>
                <span className="sr-only">
                  Profile match: {match.fitScore} out of 100. This is not an admission probability.
                </span>
                <span aria-hidden="true">Profile match {match.fitScore}/100</span>
              </MetaChip>
            ) : null}
            <li>
              <Link
                to={`/opportunities/${application.opportunityId}`}
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-meta font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                View opportunity
                <ExternalLink aria-hidden="true" className="size-3" />
              </Link>
            </li>
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ScoreRing
            value={percent}
            label={`Application completion: ${percent} out of 100`}
            size={88}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-xl leading-none font-semibold text-text">{percent}%</span>
            <span className="text-meta text-text-muted">
              {application.completion.completed} of {application.completion.total} requirements
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Tabs defaultValue="requirements">
          <TabsList>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="drafts">Writing drafts</TabsTrigger>
            <TabsTrigger value="more">More</TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="pt-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
                  <ListTodo aria-hidden="true" className="size-4 text-text-muted" />
                  Application checklist
                </h2>
                <span className="text-meta text-text-muted">
                  {application.completion.completed} of {application.completion.total} ready
                </span>
              </div>

              <ul className="mt-4 flex flex-col gap-2.5">
                {application.checklist.map((item) => (
                  <ChecklistRow key={item.id} item={item} />
                ))}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="pt-4">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
                <Check aria-hidden="true" className="size-4 text-text-muted" />
                Tasks
              </h2>
              {application.tasks.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">
                  Nothing is scheduled yet. Tasks appear here when a requirement needs a step that is
                  not a document.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {application.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="pt-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
                  <FileText aria-hidden="true" className="size-4 text-text-muted" />
                  Documents
                </h2>
                <Button asChild variant="outline" size="sm">
                  <Link to="/documents">Open library</Link>
                </Button>
              </div>

              {linkedDocuments.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">
                  No documents are linked to this application yet. Upload one in the library and it
                  will appear against the requirement it supports.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {linkedDocuments.map((document) => (
                    <li
                      key={document.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border px-3.5 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm text-text">
                        <FileText aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
                        <span className="truncate">{document.filename}</span>
                      </span>
                      <Badge tone={DOC_STATUS_TONE[document.status]}>
                        {document.status === 'processed'
                          ? 'Ready to use'
                          : document.status === 'needs_review'
                            ? 'Needs your review'
                            : document.status === 'failed'
                              ? 'Could not read'
                              : document.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="drafts" className="pt-4">
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
                  <PenLine aria-hidden="true" className="size-4 text-text-muted" />
                  Writing drafts
                </h2>
                {application.draftIds.length === 0 ? (
                  <p className="mt-3 text-sm text-text-muted">
                    No drafts yet. Start one below and the agent will draft it from your confirmed
                    facts — never from invented achievements.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-2">
                    {application.draftIds.map((draftId) => {
                      const draft = drafts?.drafts.find((item) => item.id === draftId);

                      return (
                        <li
                          key={draftId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border px-3.5 py-3"
                        >
                          <Link
                            to={`/writing/${draftId}`}
                            className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                          >
                            <FileText aria-hidden="true" className="size-4 shrink-0" />
                            <span className="truncate">{draft?.title ?? 'Open writing studio'}</span>
                          </Link>
                          {draft ? (
                            <span className="text-meta text-text-muted">
                              version {draft.currentVersion}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              <DraftActions applicationId={application.id} />
            </div>
          </TabsContent>

          <TabsContent value="more" className="pt-4">
            <Card className="p-5">
              <h2 className="text-card-title font-semibold text-text">About this application</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {application.notes ?? 'No notes yet. Ask Oppulse to add one after a conversation.'}
              </p>

              <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-meta font-medium text-text-muted">Created</dt>
                  <dd className="text-sm text-text">{formatDate(application.createdAt)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-meta font-medium text-text-muted">Last updated</dt>
                  <dd className="text-sm text-text">{formatDate(application.updatedAt)}</dd>
                </div>
                {application.officialUrl ? (
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <dt className="text-meta font-medium text-text-muted">Official source</dt>
                    <dd>
                      <a
                        href={application.officialUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-sm text-info underline-offset-2 hover:underline"
                      >
                        {new URL(application.officialUrl).hostname.replace(/^www\./, '')}
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          </TabsContent>
        </Tabs>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
              Next best action
            </h2>
            {application.nextBestAction ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-text">
                  {application.nextBestAction}
                </p>
                <Button size="sm" className="mt-4 w-full" onClick={askOppulse}>
                  <MessageSquareText aria-hidden="true" className="size-4" />
                  Ask Oppulse about this
                </Button>
              </>
            ) : (
              <p className="mt-3 text-sm text-text-muted">
                Nothing is blocked. Check back after the next source review.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
              <CalendarClock aria-hidden="true" className="size-4 text-text-muted" />
              Upcoming deadlines
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {application.deadline ? (
                <li className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-text">Programme deadline</span>
                  <span
                    className={cn(
                      'shrink-0 text-right font-medium',
                      application.deadlineVerified ? 'text-text' : 'text-warning',
                    )}
                  >
                    {formatDate(application.deadline, { day: 'numeric', month: 'short' })}
                    {application.deadlineVerified ? '' : ' · unverified'}
                  </span>
                </li>
              ) : null}
              {upcomingTasks.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-text-muted">{task.label}</span>
                  <span className="shrink-0 text-right font-medium text-text">
                    {formatDate(task.dueDate, { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
              {!application.deadline && upcomingTasks.length === 0 ? (
                <li className="text-sm text-text-muted">No dated deadlines are recorded.</li>
              ) : null}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
              <MessageSquareText aria-hidden="true" className="size-4 text-text-muted" />
              Ask Oppulse
            </h2>
            <p className="mt-3 text-sm text-text-muted">
              Questions about eligibility, deadlines or what to write next — the agent already has
              this application in context.
            </p>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={askOppulse}>
              Start a conversation
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/** A single requirement: status, evidence, date, and the action that fits it. */
function ChecklistRow({ item }: { item: ChecklistItem }) {
  const Icon = CHECKLIST_ICON[item.status];

  return (
    <li className="flex flex-col gap-2.5 rounded-card border border-border px-3.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex min-w-0 gap-2.5">
        <Icon
          aria-hidden="true"
          className={cn('mt-0.5 size-4.5 shrink-0', CHECKLIST_ICON_TONE[item.status])}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-text">{item.label}</span>
          <span className="text-meta text-text-muted">
            {item.source ? `Source: ${item.source}` : 'Source not recorded'}
            {item.dueDate
              ? ` · due ${formatDate(item.dueDate, { day: 'numeric', month: 'short' })}`
              : ''}
          </span>
          {item.note ? <p className="text-meta text-text-muted">{item.note}</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
        <Badge tone={CHECKLIST_TONE[item.status]}>{CHECKLIST_LABEL[item.status]}</Badge>
        {item.documentId ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/documents">Open document</Link>
          </Button>
        ) : item.status === 'missing' || item.status === 'needs_attention' ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/documents">Add document</Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {task.status === 'done' ? (
        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
      )}
      <span className="flex flex-col gap-0.5">
        <span className={task.status === 'done' ? 'text-text-muted line-through' : 'text-text'}>
          {task.label}
        </span>
        {task.dueDate ? (
          <span className="text-meta text-text-muted">
            Due {formatDate(task.dueDate, { day: 'numeric', month: 'short' })}
          </span>
        ) : null}
        {task.blockedReason ? (
          <span className="text-meta text-warning">Blocked: {task.blockedReason}</span>
        ) : null}
      </span>
    </li>
  );
}

/** A compact fact about the opportunity, shown in the header chip row. */
function MetaChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <li
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-meta font-medium',
        tone === 'neutral' && 'border-border bg-surface-subtle text-text-muted',
        tone === 'success' && 'border-success/25 bg-success-surface text-success',
        tone === 'warning' && 'border-warning/25 bg-warning-surface text-warning',
      )}
    >
      {children}
    </li>
  );
}
