import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Circle,
  ExternalLink,
  FileText,
  ListTodo,
  MessageSquareText,
  PenLine,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/display';
import { Skeleton } from '@/components/ui/tooltip';
import { ErrorState, NotFoundState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import { ApplicationWorkflow } from '@/components/applications/application-workflow';
import { DraftActions } from '@/components/applications/draft-actions';
import { ApiError } from '@/lib/api/errors';
import { useAgent } from '@/lib/agent-context';
import { useApplication, useDrafts } from '@/lib/queries';
import type { ChecklistItem, Task } from '@/lib/schemas';

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

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setContext } = useAgent();
  const { data: application, isPending, error, refetch } = useApplication(id ?? null);
  const { data: drafts } = useDrafts(application?.id ?? null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-72" />
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

  const percent =
    application.completion.total > 0
      ? Math.round((application.completion.completed / application.completion.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/applications">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to applications
        </Link>
      </Button>

      <ApplicationWorkflow application={application} drafts={drafts?.drafts ?? []} />

      <PageHeader
        title={application.opportunityTitle}
        description={application.institution}
        actions={
          <>
            {application.officialUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={application.officialUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Official site
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => {
                setContext({ applicationId: application.id });
                void navigate('/assistant');
              }}
            >
              <MessageSquareText aria-hidden="true" className="size-4" />
              Ask Oppulse
            </Button>
          </>
        }
      />

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium text-text-muted">Overall progress</span>
            <span className="text-sm text-text">
              {application.completion.completed} of {application.completion.total} requirements
              ready
            </span>
          </div>
          {application.deadlineVerified && application.deadline ? (
            <Badge tone="success">
              Verified deadline ·{' '}
              {new Date(application.deadline).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Badge>
          ) : (
            <Badge tone="warning">Deadline not verified</Badge>
          )}
        </div>

        <Progress value={percent} label="Application completion" />

        {application.nextBestAction ? (
          <p className="rounded-button bg-primary/8 px-3 py-2 text-sm text-primary">
            <span className="font-medium">Next best action: </span>
            {application.nextBestAction}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
            <ListTodo aria-hidden="true" className="size-4 text-text-muted" />
            Application checklist
          </h2>
          <ul className="flex flex-col gap-2">
            {application.checklist.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1.5 rounded-card border border-border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="flex items-start gap-2 text-sm text-text">
                    {item.status === 'done' ? (
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <Circle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-text-muted"
                      />
                    )}
                    {item.label}
                  </span>
                  <Badge tone={CHECKLIST_TONE[item.status]}>{CHECKLIST_LABEL[item.status]}</Badge>
                </div>
                <p className="text-meta text-text-muted">
                  {item.source ? `Source: ${item.source}` : 'Source not recorded'}
                  {item.dueDate
                    ? ` · due ${new Date(item.dueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}`
                    : ''}
                </p>
                {item.note ? <p className="text-sm text-text-muted">{item.note}</p> : null}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
              <ListTodo aria-hidden="true" className="size-4 text-text-muted" />
              Tasks
            </h2>
            <ul className="flex flex-col gap-2">
              {application.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
              <PenLine aria-hidden="true" className="size-4 text-text-muted" />
              Writing drafts
            </h2>
            {application.draftIds.length === 0 ? (
              <p className="text-sm text-text-muted">
                No drafts yet. Start one below and the agent will draft it from your confirmed facts
                — never from invented achievements.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {application.draftIds.map((draftId) => {
                  const draft = drafts?.drafts.find((item) => item.id === draftId);

                  return (
                    <li key={draftId} className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/writing/${draftId}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                      >
                        <FileText aria-hidden="true" className="size-4" />
                        {draft?.title ?? 'Open writing studio'}
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
      </div>
    </div>
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
            Due{' '}
            {new Date(task.dueDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        ) : null}
        {task.blockedReason ? (
          <span className="text-meta text-warning">Blocked: {task.blockedReason}</span>
        ) : null}
      </span>
    </li>
  );
}
