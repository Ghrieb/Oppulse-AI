import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, RefreshingIndicator } from '@/components/feedback/states';
import { Skeleton } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useOpportunities } from '@/lib/queries';
import type { Opportunity } from '@/lib/schemas';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'fully_funded', label: 'Fully funded' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'unresolved', label: 'Needs verification' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

/**
 * Ranked opportunity rail.
 *
 * The filter tabs are deliberately qualitative: a student deciding what to
 * spend time on cares about "fully funded" and "needs verification" far
 * more than a funding-coverage code.
 */
export function OpportunityRail({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<FilterId>('all');
  const { data, isPending, isFetching, error, refetch } = useOpportunities();

  const opportunities = data?.opportunities ?? [];
  const matches = data?.matches ?? [];

  const visible = useMemo(() => {
    const list = data?.opportunities ?? [];
    const matchList = data?.matches ?? [];
    const matchFor = (id: string) => matchList.find((match) => match.opportunityId === id);

    switch (filter) {
      case 'fully_funded':
        return list.filter((item) => item.funding.coverage === 'fully_funded');
      case 'competitive':
        return list.filter((item) => {
          const competitiveness = matchFor(item.id)?.competitiveness;
          return competitiveness === 'high' || competitiveness === 'moderate';
        });
      case 'unresolved':
        return list.filter((item) => {
          const match = matchFor(item.id);
          return (
            match?.eligibility === 'unresolved' ||
            item.deadline.status === 'conflict' ||
            item.deadline.status === 'not_found'
          );
        });
      default:
        return list;
    }
  }, [filter, data]);

  if (isPending) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-5">
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          message="We could not load your opportunities."
        />
      </Card>
    );
  }

  return (
    <Card className="flex min-h-[32rem] flex-col overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-card-title font-semibold text-text">Top opportunities</h2>
          <span className="flex items-center gap-2 text-meta text-text-muted">
            {isFetching ? <RefreshingIndicator /> : null}
            {opportunities.length} found
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              aria-pressed={filter === entry.id}
              className={cn(
                'min-h-9 rounded-full border px-3 text-meta font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                filter === entry.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface text-text-muted hover:bg-surface-subtle',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex scrollbar-subtle flex-1 flex-col gap-3 overflow-y-auto p-4">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Filter className="size-5" />}
            title="Nothing matches this filter"
            description="Change the filter, or broaden the mission that produced these results."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/goals">Edit mission</Link>
              </Button>
            }
          />
        ) : (
          visible.map((opportunity) => {
            const match = matches.find((item) => item.opportunityId === opportunity.id);
            const isSelected = opportunity.id === selectedId;

            return (
              <button
                key={opportunity.id}
                type="button"
                onClick={() => onSelect(opportunity.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex w-full flex-col gap-2 rounded-card border p-4 text-left transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                  isSelected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-surface hover:bg-surface-subtle',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-2 text-sm leading-snug font-semibold text-text">
                      {opportunity.title}
                    </span>
                    <span className="line-clamp-1 text-meta text-text-muted">
                      {opportunity.institution}
                    </span>{' '}
                  </div>
                  {match ? (
                    <span className="shrink-0 text-lg font-semibold text-primary tabular-nums">
                      {match.fitScore}
                      <span className="sr-only"> out of 100 profile match</span>
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <FundingTag coverage={opportunity.funding.coverage} />
                  <Badge tone="neutral">{opportunity.country.name}</Badge>
                  <Badge tone="neutral">{opportunity.type.replace(/_/g, ' ')}</Badge>
                  {opportunity.deadline.status === 'conflict' ? (
                    <Badge tone="warning">Deadline conflict</Badge>
                  ) : null}
                  {match?.eligibility === 'unresolved' ? (
                    <Badge tone="warning">Needs verification</Badge>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-3">
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link to="/opportunities">
            <Sparkles aria-hidden="true" className="size-4" />
            See all opportunities
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function FundingTag({ coverage }: { coverage: Opportunity['funding']['coverage'] }) {
  const map = {
    fully_funded: { label: 'Fully funded', tone: 'success' as const },
    partial: { label: 'Partially funded', tone: 'warning' as const },
    tuition_only: { label: 'Tuition only', tone: 'warning' as const },
    unfunded: { label: 'Not funded', tone: 'danger' as const },
    unknown: { label: 'Funding unknown', tone: 'neutral' as const },
  };
  const meta = map[coverage];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
