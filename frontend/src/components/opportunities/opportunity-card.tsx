import { Link } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  ExternalLink,
  MoreHorizontal,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/controls';
import { CountryIdentityBadge } from '@/components/resources/country-identity';
import { InstitutionLogo } from '@/components/resources/institution-logo';
import {
  CompetitivenessBadge,
  DeadlineBadge,
  DeadlineLine,
  EligibilitySummary,
  FitScore,
} from './assessment';
import { cn } from '@/lib/cn';
import type { Match, Opportunity } from '@/lib/schemas';

export interface OpportunityCardProps {
  opportunity: Opportunity;
  match: Match | null;
  onToggleSave?: () => void;
  onDismiss?: () => void;
  onAddToApplication?: () => void;
  saving?: boolean;
  dismissing?: boolean;
  addingToApplication?: boolean;
  className?: string;
}

/**
 * Opportunity card.
 *
 * The order follows the specification: title, institution, type and source,
 * deadline, funding, fit, eligibility, recommendation, one warning, then the
 * actions. Fit is labelled "profile match" so it is never read as a
 * probability of admission.
 */
export function OpportunityCard({
  opportunity,
  match,
  onToggleSave,
  onDismiss,
  onAddToApplication,
  saving = false,
  dismissing = false,
  addingToApplication = false,
  className,
}: OpportunityCardProps) {
  const warning = match?.warnings[0];
  const recommendation = match?.recommendation;

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="flex flex-col gap-3 p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <InstitutionLogo brand={opportunity.institutionBrand} size={40} />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-meta font-medium text-text-muted">{opportunity.institution}</p>
              <h3 className="text-card-title leading-tight font-semibold text-text">
                <Link
                  to={`/opportunities/${opportunity.id}`}
                  className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  {opportunity.title}
                </Link>
              </h3>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-text-muted">
                <CountryIdentityBadge country={opportunity.country} size="xs" />
                <span className="inline-flex items-center gap-1">
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  {opportunity.sourceDomain}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {onToggleSave ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSave}
                loading={saving}
                aria-label={opportunity.saved ? 'Remove from my list' : 'Save to my list'}
              >
                {opportunity.saved ? (
                  <BookmarkCheck aria-hidden="true" className="size-5 text-primary" />
                ) : (
                  <Bookmark aria-hidden="true" className="size-5" />
                )}
              </Button>
            ) : null}

            {onDismiss || onAddToApplication ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal aria-hidden="true" className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {onAddToApplication ? (
                    <DropdownMenuItem disabled={addingToApplication} onSelect={onAddToApplication}>
                      <TrendingUp aria-hidden="true" className="size-4 text-text-muted" />
                      Add to application workspace
                    </DropdownMenuItem>
                  ) : null}
                  {onDismiss ? (
                    <DropdownMenuItem disabled={dismissing} onSelect={onDismiss}>
                      Not for me
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {opportunity.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium text-text-muted">Deadline</span>
            <DeadlineLine deadline={opportunity.deadline} />
            <DeadlineBadge deadline={opportunity.deadline} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-meta font-medium text-text-muted">Funding</span>
            <FundingSummary funding={opportunity.funding} />
          </div>
        </div>

        {match ? (
          <div className="flex flex-wrap items-center gap-3 rounded-button bg-surface-subtle p-3">
            <FitScore match={match} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <EligibilitySummary eligibility={match.eligibility} />
                <CompetitivenessBadge value={match.competitiveness} />
              </div>
              {recommendation ? <p className="text-sm text-text">{recommendation}</p> : null}
            </div>
          </div>
        ) : null}

        {warning ? (
          <p className="rounded-button bg-warning-surface px-3 py-2 text-meta text-warning">
            {warning}
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border p-4">
        <Button asChild size="sm" className="flex-1 sm:flex-none">
          <Link to={`/opportunities/${opportunity.id}`}>View full details</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={opportunity.canonicalUrl} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden="true" className="size-4" />
            Official call
          </a>
        </Button>
        {onAddToApplication ? (
          <Button
            variant="outline"
            size="sm"
            loading={addingToApplication}
            loadingLabel="Adding…"
            onClick={onAddToApplication}
          >
            <Calendar aria-hidden="true" className="size-4" />
            Add to application
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function FundingSummary({ funding }: { funding: Opportunity['funding'] }) {
  const label: Record<typeof funding.coverage, string> = {
    fully_funded: 'Fully funded',
    partial: 'Partially funded',
    tuition_only: 'Tuition only',
    unfunded: 'Not funded',
    unknown: 'Funding unknown',
  };

  const tone: Record<typeof funding.coverage, 'success' | 'warning' | 'danger' | 'neutral'> = {
    fully_funded: 'success',
    partial: 'warning',
    tuition_only: 'warning',
    unfunded: 'danger',
    unknown: 'neutral',
  };

  return (
    <div className="flex flex-col gap-1">
      <Badge tone={tone[funding.coverage]}>{label[funding.coverage]}</Badge>
      {funding.estimatedGap ? (
        <p className="text-meta text-text-muted">
          Gap ≈ {funding.estimatedGap.amount} {funding.estimatedGap.currency}
        </p>
      ) : (
        <p className="text-meta text-text-muted">{funding.note ?? 'No funding gap identified.'}</p>
      )}
    </div>
  );
}
