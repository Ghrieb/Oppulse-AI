import { Link } from 'react-router-dom';
import { ClipboardList, ExternalLink, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/display';
import { Skeleton } from '@/components/ui/tooltip';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import { useApplications } from '@/lib/queries';
import type { Application } from '@/lib/schemas';
import { STATUS_LABEL, STATUS_TONE } from './status';

/**
 * Application workspaces.
 *
 * A workspace is a progress cockpit, not a bookmark list: it always shows
 * the next best action and the completion derived from real checklist items.
 */
export function ApplicationsPage() {
  const { data, isPending, error, refetch } = useApplications();

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Application workspace" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const applications = data?.applications ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Application workspace"
        description="Every opportunity you are actually pursuing, with the requirement list, the tasks and the drafts that go with it."
      />

      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No applications yet"
          description="Save an opportunity from your results and it becomes a workspace: a checklist drawn from the call, a task list, and a place to write."
          action={
            <Button asChild size="sm">
              <Link to="/opportunities">
                <Pencil aria-hidden="true" className="size-4" />
                Browse opportunities
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {applications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({ application }: { application: Application }) {
  const percent =
    application.completion.total > 0
      ? Math.round((application.completion.completed / application.completion.total) * 100)
      : 0;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-card-title font-semibold text-text">
            {application.opportunityTitle}
          </h2>
          <p className="text-sm text-text-muted">{application.institution}</p>
        </div>
        <Badge tone={STATUS_TONE[application.status]}>{STATUS_LABEL[application.status]}</Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-meta">
          <span className="text-text-muted">
            {application.completion.completed} of {application.completion.total} requirements ready
          </span>
          {application.deadlineVerified && application.deadline ? (
            <span className="font-medium text-text">
              Due{' '}
              {new Date(application.deadline).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-warning">Deadline unverified</span>
          )}
        </div>
        <Progress value={percent} label="Application progress" />
      </div>

      {application.nextBestAction ? (
        <p className="rounded-button bg-primary/8 px-3 py-2 text-sm text-primary">
          <span className="font-medium">Next: </span>
          {application.nextBestAction}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button asChild size="sm">
          <Link to={`/applications/${application.id}`}>Continue application</Link>
        </Button>
        {application.officialUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={application.officialUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden="true" className="size-4" />
              Official site
            </a>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
