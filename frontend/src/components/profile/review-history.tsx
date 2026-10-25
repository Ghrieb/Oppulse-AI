import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback/states';
import type { FactRevisionAction, ProfileFactRevision } from '@/lib/schemas';

const ACTION_META: Record<
  FactRevisionAction,
  { label: string; tone: 'success' | 'info' | 'neutral' | 'warning' }
> = {
  confirmed: { label: 'Confirmed', tone: 'success' },
  corrected: { label: 'Corrected', tone: 'info' },
  excluded: { label: 'Excluded from AI use', tone: 'neutral' },
  rejected: { label: 'Marked as not mine', tone: 'neutral' },
  restored: { label: 'Restored', tone: 'warning' },
};

/**
 * The review history.
 *
 * Every change the student made is recorded, so the passport can show not
 * only what Oppulse knows but how it came to know it.
 */
export function ReviewHistory({
  revisions,
  className,
}: {
  revisions: ProfileFactRevision[];
  className?: string | undefined;
}) {
  if (revisions.length === 0) {
    return (
      <EmptyState
        className={className}
        icon={<History className="size-5" />}
        title="Nothing reviewed yet"
        description="When you confirm, correct or exclude a fact, it will be recorded here with the value before and after."
      />
    );
  }

  return (
    <Card className={className}>
      <ul className="divide-y divide-border" aria-label="Review history">
        {revisions.map((revision) => {
          const meta = ACTION_META[revision.action];

          return (
            <li key={revision.id} className="flex flex-col gap-1.5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">{revision.factLabel}</span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>

              {revision.previousValue &&
              revision.newValue &&
              revision.previousValue !== revision.newValue ? (
                <p className="text-sm text-text-muted">
                  <span className="line-through">{revision.previousValue}</span>
                  <span aria-hidden="true"> → </span>
                  <span className="font-medium text-text">{revision.newValue}</span>
                </p>
              ) : revision.newValue ? (
                <p className="text-sm text-text-muted">{revision.newValue}</p>
              ) : null}

              <p className="text-meta text-text-muted">
                {new Date(revision.createdAt).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {revision.sourceDocumentName ? ` · ${revision.sourceDocumentName}` : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
