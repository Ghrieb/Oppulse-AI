import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { NextAction } from '@/lib/schemas';

const KIND_ICON: Record<NextAction['kind'], LucideIcon> = {
  confirm_fact: ArrowRight,
  resolve_conflict: ArrowRight,
  complete_document: ArrowRight,
  review_proposal: ArrowRight,
  start_run: ArrowRight,
  check_source: ArrowRight,
  finish_draft: ArrowRight,
  prepare_checklist: ArrowRight,
};

/**
 * The next best action.
 *
 * One recommendation, tied to a real blocker, with the reason it matters and
 * a link to the place where it can be resolved. It replaces the impulse to
 * show everything at once with the impulse to help the student act.
 */
export function NextBestAction({
  action,
  className,
}: {
  action: NextAction | null | undefined;
  className?: string;
}) {
  if (!action) {
    return (
      <Card className={className}>
        <div className="flex items-start gap-3 p-4">
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-button bg-success/12 text-success"
          >
            <ArrowRight className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-text">You are all caught up</span>
            <p className="text-sm text-text-muted">
              Nothing is blocking you right now. Oppulse will tell you the moment a monitored source
              changes.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const Icon = KIND_ICON[action.kind];

  return (
    <Card
      className={cn(
        'border-primary/30 bg-primary/[0.04] shadow-[0_1px_2px_0_rgb(11_23_48/0.04)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-button bg-primary/12 text-primary"
        >
          <Icon className="size-4" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-meta font-medium text-primary">Next best action</span>
          <span className="text-card-title font-semibold text-text">{action.title}</span>
          <p className="text-sm text-text-muted">{action.rationale}</p>
        </div>

        <Button asChild size="sm" className="shrink-0">
          <Link to={action.route}>
            {action.cta}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
