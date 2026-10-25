import { Link } from 'react-router-dom';
import { CalendarClock, Clock, FileWarning, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MINUTES_PER_ITEM, summariseApplication } from '@/lib/application-workflow';
import type { Application, Draft } from '@/lib/schemas';

/**
 * The working-applicant view.
 *
 * A student juggling several applications needs to know how much work is
 * left, how urgent it is, and where they stopped. All three are derived
 * from data the workspace already holds.
 */

const PRIORITY_META = {
  tight: { label: 'Tight', tone: 'danger' as const },
  normal: { label: 'Keep an eye on it', tone: 'warning' as const },
  comfortable: { label: 'Comfortable', tone: 'success' as const },
  unknown: { label: 'Deadline unverified', tone: 'neutral' as const },
};

export function ApplicationWorkflow({
  application,
  drafts,
  className,
}: {
  application: Application;
  drafts: Draft[];
  className?: string | undefined;
}) {
  const summary = summariseApplication(application);
  const priority = PRIORITY_META[summary.priority];

  const lastDraft = [...drafts]
    .filter((draft) => draft.applicationId === application.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const hours = Math.floor(summary.estimatedMinutes / 60);
  const minutes = summary.estimatedMinutes % 60;
  const effort = hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` : `${minutes}m`;

  return (
    <Card className={className}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-2.5">
          <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <div className="flex flex-col gap-0.5">
            <span className="text-meta font-medium text-text-muted">Work left</span>
            <span className="text-sm font-medium text-text">
              {summary.remaining === 0
                ? 'Nothing outstanding'
                : `About ${effort} across ${summary.remaining} requirement${summary.remaining === 1 ? '' : 's'}`}
            </span>
            <span className="text-meta text-text-muted">
              Assumes {MINUTES_PER_ITEM} minutes per requirement.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <div className="flex flex-col gap-0.5">
            <span className="text-meta font-medium text-text-muted">Deadline</span>
            <span className="text-sm font-medium text-text">
              {summary.daysLeft === null
                ? 'No deadline verified'
                : `${summary.daysLeft} day${summary.daysLeft === 1 ? '' : 's'} left`}
            </span>
            <Badge tone={priority.tone} className="self-start">
              {priority.label}
            </Badge>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <FileWarning aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <div className="flex flex-col gap-0.5">
            <span className="text-meta font-medium text-text-muted">Missing documents</span>
            <span className="text-sm font-medium text-text">
              {summary.missingDocuments === 0
                ? 'You have everything listed'
                : `${summary.missingDocuments} to upload`}
            </span>
            {summary.missingDocuments > 0 ? (
              <Link
                to="/documents"
                className="text-meta font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Upload them
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {lastDraft ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-text-muted">
            <span className="font-medium text-text">Continue where you left off:</span>{' '}
            {lastDraft.title}, version {lastDraft.currentVersion}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to={`/writing/${lastDraft.id}`}>
              <PlayCircle aria-hidden="true" className="size-4" />
              Open the draft
            </Link>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
