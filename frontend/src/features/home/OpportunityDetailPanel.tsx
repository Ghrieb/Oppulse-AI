import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CircleHelp,
  ExternalLink,
  FileText,
  MessageSquareText,
  Pin,
  PinOff,
  Pencil,
  Search,
  Star,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/tooltip';
import {
  DeadlineLine,
  EligibilitySummary,
  FitScore,
  FundingCoverage,
} from '@/components/opportunities/assessment';
import {
  competitivenessTone,
  competitivenessValue,
  confidenceTone,
  confidenceValue,
  eligibilityValue,
} from '@/components/opportunities/assessment-values';
import { EvidenceDrawer } from '@/components/opportunities/evidence-drawer';
import { ErrorState, RefreshingIndicator } from '@/components/feedback/states';
import { CountryIdentityBadge } from '@/components/resources/country-identity';
import { InstitutionLogo } from '@/components/resources/institution-logo';
import { cn } from '@/lib/cn';
import { useAgent } from '@/lib/agent-context';
import { useOpportunity } from '@/lib/queries';

/**
 * Deep analysis panel.
 *
 * The five assessment concepts are shown as labelled tiles, and every
 * high-stakes claim is one click from its source (spec §6.5).
 *
 * The panel is controllable: it can be closed, and it can pin the current
 * opportunity into the agent's working context, so the chat and the panel
 * agree about what the student is looking at.
 */
export function OpportunityDetailPanel({
  opportunityId,
  onClose,
}: {
  opportunityId: string | null;
  onClose?: () => void;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { data, isPending, isFetching, error, refetch } = useOpportunity(opportunityId);
  const { context, setContext } = useAgent();

  if (!opportunityId) {
    return (
      <Card className="grid min-h-[32rem] place-items-center p-8">
        <p className="max-w-xs text-center text-sm text-text-muted">
          Select an opportunity to see its full analysis, eligibility reasoning, funding breakdown
          and source evidence.
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="grid min-h-[32rem] place-items-center p-8">
        <div className="flex max-w-md flex-col items-center gap-3">
          <ErrorState
            error={error}
            onRetry={() => void refetch()}
            message="We could not load this opportunity. Your list and your chat are unaffected."
          />
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Back to results
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </Card>
    );
  }

  const { opportunity, match, evidence, sources } = data;
  const isPinned = context.opportunityId === opportunity.id;

  return (
    <>
      <Card className="flex min-h-[32rem] flex-col overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
              <InstitutionLogo brand={opportunity.institutionBrand} size={40} />
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-card-title leading-tight font-semibold text-text">
                  {opportunity.title}
                </h2>
                <p className="text-sm text-text-muted">{opportunity.institution}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isFetching ? <RefreshingIndicator className="mr-1" /> : null}
              {opportunity.funding.coverage === 'fully_funded' ? (
                <Badge tone="success">Fully funded</Badge>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setContext(
                    isPinned ? { opportunityId: undefined } : { opportunityId: opportunity.id },
                  )
                }
                aria-pressed={isPinned}
                className={cn(
                  'grid size-9 place-items-center rounded-button transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                  isPinned
                    ? 'bg-primary/10 text-primary hover:bg-primary/15'
                    : 'text-text-muted hover:bg-surface-subtle',
                )}
              >
                {isPinned ? (
                  <PinOff aria-hidden="true" className="size-4" />
                ) : (
                  <Pin aria-hidden="true" className="size-4" />
                )}
                <span className="sr-only">
                  {isPinned ? 'Unpin from chat context' : 'Pin to chat context'}
                </span>
              </button>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'grid size-9 place-items-center rounded-button text-text-muted transition-colors',
                    'hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                  )}
                >
                  <X aria-hidden="true" className="size-4" />
                  <span className="sr-only">Close the opportunity panel</span>
                </button>
              ) : null}
            </div>
          </div>

          {isPinned ? (
            <Badge tone="info">
              <Pin aria-hidden="true" className="size-3" />
              Pinned — the agent answers with this opportunity in context
            </Badge>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-text-muted">
            <CountryIdentityBadge country={opportunity.country} size="xs" />
            <span className="inline-flex items-center gap-1">
              <ExternalLink aria-hidden="true" className="size-3.5" />
              {opportunity.sourceDomain}
            </span>
            <span>{opportunity.type.replace(/_/g, ' ')}</span>
          </div>

          {match ? (
            <div className="grid grid-cols-2 gap-2">
              <MetricTile>
                <FitScore match={match} size="sm" />
              </MetricTile>
              <MetricTile>
                <span className="text-sm font-semibold text-text">
                  {eligibilityValue(match.eligibility)}
                </span>
                <span className="text-meta text-text-muted">Eligibility</span>
              </MetricTile>
              <MetricTile>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    competitivenessTone(match.competitiveness) === 'success'
                      ? 'text-success'
                      : competitivenessTone(match.competitiveness) === 'warning'
                        ? 'text-warning'
                        : 'text-text-muted',
                  )}
                >
                  {competitivenessValue(match.competitiveness)}
                </span>
                <span className="text-meta text-text-muted">Competition</span>
              </MetricTile>
              <MetricTile>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    confidenceTone(match.confidence) === 'success'
                      ? 'text-success'
                      : confidenceTone(match.confidence) === 'warning'
                        ? 'text-warning'
                        : 'text-text-muted',
                  )}
                >
                  {confidenceValue(match.confidence)}
                </span>
                <span className="text-meta text-text-muted">Confidence</span>
              </MetricTile>
            </div>
          ) : null}
        </div>

        <Tabs defaultValue="overview" className="flex flex-1 flex-col">
          <TabsList className="px-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="funding">Funding</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
          </TabsList>

          <div className="scrollbar-subtle flex-1 overflow-y-auto p-5">
            <TabsContent value="overview" className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-text">{opportunity.summary}</p>

              {match ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-text">Why the agent recommends it</h3>
                  <ul className="flex flex-col gap-1.5">
                    {match.reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-2 text-sm text-text">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success"
                        />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">Deadline</h3>
                <DeadlineLine deadline={opportunity.deadline} />
              </div>

              {evidence.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setEvidenceOpen(true)}>
                  <BookOpen aria-hidden="true" className="size-4" />
                  View {evidence.length} source citation{evidence.length === 1 ? '' : 's'}
                </Button>
              ) : null}
            </TabsContent>

            <TabsContent value="eligibility" className="flex flex-col gap-3">
              {match ? <EligibilitySummary eligibility={match.eligibility} /> : null}
              <ul className="flex flex-col gap-3">
                {opportunity.requirements.map((requirement) => (
                  <li key={requirement.id} className="rounded-card border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text">{requirement.label}</span>
                      <Badge
                        tone={
                          requirement.status === 'likely'
                            ? 'success'
                            : requirement.status === 'unresolved'
                              ? 'warning'
                              : requirement.status === 'ineligible'
                                ? 'danger'
                                : 'neutral'
                        }
                      >
                        {requirement.status === 'likely'
                          ? 'Met'
                          : requirement.status === 'unresolved'
                            ? 'Unresolved'
                            : requirement.status === 'ineligible'
                              ? 'Not met'
                              : 'Not applicable'}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-text-muted">{requirement.explanation}</p>
                    {requirement.sourceClause ? (
                      <blockquote className="mt-2 border-l-2 border-border pl-3 text-meta text-text-muted italic">
                        {requirement.sourceClause}
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="funding">
              <FundingCoverage funding={opportunity.funding} />
            </TabsContent>

            <TabsContent value="evidence" className="flex flex-col gap-3">
              {evidence.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No claim has been backed by a source yet for this opportunity.
                </p>
              ) : (
                <>
                  <ul className="flex flex-col gap-2">
                    {evidence.map((item) => (
                      <li key={item.id} className="rounded-card border border-border p-3">
                        <p className="text-sm font-medium text-text">{item.claim}</p>
                        <p className="mt-1 text-meta text-text-muted">
                          {item.quality === 'official' ? 'Official source' : 'Secondary source'} ·
                          retrieved{' '}
                          {new Date(item.retrievedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" onClick={() => setEvidenceOpen(true)}>
                    <FileText aria-hidden="true" className="size-4" />
                    Open the evidence drawer
                  </Button>
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
          <Button asChild size="sm" className="flex-1 sm:flex-none">
            <a href={opportunity.canonicalUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden="true" className="size-4" />
              Open official site
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/applications?opportunity=${opportunity.id}`}>
              <Pencil aria-hidden="true" className="size-4" />
              Add to my plan
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/assistant">
              <MessageSquareText aria-hidden="true" className="size-4" />
              Ask a question
            </Link>
          </Button>
        </div>

        <div className="flex items-start gap-2 border-t border-border bg-surface-subtle p-4">
          <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <p className="text-meta text-text-muted">
            Not the right fit?{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Tell us why
            </button>{' '}
            so future recommendations improve.
          </p>
        </div>
      </Card>

      <EvidenceDrawer
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        evidence={evidence}
        sources={sources}
      />
    </>
  );
}

function MetricTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-button bg-surface-subtle p-2 text-center">
      {children}
    </div>
  );
}

/** Small helper used by the panel header in the wider layout. */
export function SearchHint() {
  return (
    <p className="flex items-center gap-1.5 text-meta text-text-muted">
      <Search aria-hidden="true" className="size-3.5" />
      Results are ranked against your confirmed profile.
    </p>
  );
}

/** Rating affordance used where the user can mark an opportunity. */
export function MarkInterestButton() {
  return (
    <Button variant="outline" size="sm">
      <Star aria-hidden="true" className="size-4" />
      Keep an eye on this
    </Button>
  );
}
