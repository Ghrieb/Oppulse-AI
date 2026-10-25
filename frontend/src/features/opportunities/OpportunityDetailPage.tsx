import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MessageSquareText, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/tooltip';
import { ErrorState, NotFoundState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import {
  CompetitivenessBadge,
  ConfidenceBadge,
  DeadlineLine,
  EligibilityBadge,
  EligibilitySummary,
  FitScore,
  FundingCoverage,
} from '@/components/opportunities/assessment';
import { EvidenceDrawer } from '@/components/opportunities/evidence-drawer';
import { CountryIdentityBadge } from '@/components/resources/country-identity';
import { InstitutionLogo } from '@/components/resources/institution-logo';
import { OpportunityBanner } from '@/components/resources/opportunity-banner';
import { ApiError } from '@/lib/api/errors';
import { useAgent } from '@/lib/agent-context';
import { useOpportunity, useProfile } from '@/lib/queries';

/** "research internship" → "Research Internship". */
function capitaliseWords(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Deep opportunity analysis.
 *
 * Five labelled concepts, seven sections, and a source drawer behind every
 * high-stakes claim (spec §6.5).
 */
export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setContext } = useAgent();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { data, isPending, error, refetch } = useOpportunity(id ?? null);
  const { data: profile } = useProfile();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Opportunity" />
        {error instanceof ApiError && error.code === 'NOT_FOUND' ? (
          <NotFoundState />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const { opportunity, match, evidence, sources } = data;

  return (
    <>
      <div className="flex flex-col gap-5">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to="/opportunities">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to opportunities
          </Link>
        </Button>

        <OpportunityBanner
          brand={opportunity.institutionBrand}
          programmeTitle={capitaliseWords(opportunity.type.replace(/_/g, ' '))}
          className="aspect-[1200/400] w-full"
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <InstitutionLogo brand={opportunity.institutionBrand} size={48} source="asset" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-text-muted">{opportunity.institution}</span>
              <CountryIdentityBadge country={opportunity.country} size="xs" />
            </div>
          </div>
        </div>

        <PageHeader
          title={opportunity.title}
          description={
            opportunity.duration
              ? `${capitaliseWords(opportunity.type.replace(/_/g, ' '))} · ${opportunity.duration}`
              : capitaliseWords(opportunity.type.replace(/_/g, ' '))
          }
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <a href={opportunity.canonicalUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Official call
                </a>
              </Button>
              <Button asChild size="sm">
                <Link to={`/applications?opportunity=${opportunity.id}`}>
                  <Pencil aria-hidden="true" className="size-4" />
                  Add to my plan
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setContext({ opportunityId: opportunity.id });
                  void navigate('/assistant');
                }}
              >
                <MessageSquareText aria-hidden="true" className="size-4" />
                Ask about this opportunity
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="flex flex-col items-center gap-2 p-4">
            {match ? <FitScore match={match} size="lg" /> : <span className="text-sm">—</span>}
          </Card>
          <Card className="flex flex-col gap-2 p-4">
            <span className="text-meta font-medium text-text-muted">Eligibility</span>
            {match ? (
              <EligibilitySummary eligibility={match.eligibility} />
            ) : (
              <span className="text-sm text-text-muted">Not assessed</span>
            )}
          </Card>
          <Card className="flex flex-col gap-2 p-4">
            <span className="text-meta font-medium text-text-muted">Competition</span>
            {match ? (
              <CompetitivenessBadge value={match.competitiveness} />
            ) : (
              <span className="text-sm text-text-muted">Unknown</span>
            )}
          </Card>
          <Card className="flex flex-col gap-2 p-4">
            <span className="text-meta font-medium text-text-muted">Confidence</span>
            {match ? (
              <ConfidenceBadge value={match.confidence} />
            ) : (
              <span className="text-sm text-text-muted">Unknown</span>
            )}
          </Card>
          <Card className="flex flex-col gap-2 p-4">
            <span className="text-meta font-medium text-text-muted">Deadline</span>
            <DeadlineLine deadline={opportunity.deadline} />
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="funding">Funding</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="deadline">Deadline</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="plan">Application plan</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-4 pt-4">
            <Card className="p-5">
              <h2 className="text-card-title font-semibold text-text">AI overview</h2>
              <p className="mt-2 text-sm leading-relaxed text-text">{opportunity.summary}</p>

              {match ? (
                <div className="mt-4 flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-text">Why it fits</h3>
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
                  {match.warnings.length > 0 ? (
                    <>
                      <h3 className="mt-2 text-sm font-semibold text-text">What to verify</h3>
                      <ul className="flex flex-col gap-1.5">
                        {match.warnings.map((warning) => (
                          <li key={warning} className="flex items-start gap-2 text-sm text-warning">
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning"
                            />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </TabsContent>

          <TabsContent value="eligibility" className="pt-4">
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-card-title font-semibold text-text">
                Requirement by requirement
              </h2>
              {opportunity.requirements.map((requirement) => {
                const blockingFact = requirement.profileFactKey
                  ? profile?.facts.find((fact) => fact.key === requirement.profileFactKey)
                  : undefined;
                const canFix = Boolean(
                  blockingFact && blockingFact.status !== 'confirmed' && !blockingFact.excluded,
                );

                return (
                  <div key={requirement.id} className="rounded-card border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-text">{requirement.label}</h3>
                      <EligibilityBadge status={requirement.status} />
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{requirement.explanation}</p>

                    {canFix && blockingFact ? (
                      <Button asChild size="sm" variant="outline" className="mt-3 self-start">
                        <Link to={`/profile?fact=${blockingFact.id}`}>
                          Confirm your {blockingFact.label.toLowerCase()}
                        </Link>
                      </Button>
                    ) : null}

                    {requirement.sourceClause ? (
                      <blockquote className="mt-2 border-l-2 border-border pl-3 text-meta text-text-muted italic">
                        “{requirement.sourceClause}”
                      </blockquote>
                    ) : null}
                  </div>
                );
              })}
            </Card>
          </TabsContent>

          <TabsContent value="funding" className="pt-4">
            <Card className="p-5">
              <h2 className="text-card-title font-semibold text-text">Financial analysis</h2>
              <div className="mt-3">
                <FundingCoverage funding={opportunity.funding} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="requirements" className="pt-4">
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-card-title font-semibold text-text">
                What you will need to submit
              </h2>
              <ul className="flex flex-col gap-2">
                {opportunity.requirements.map((requirement) => (
                  <li key={requirement.id} className="flex items-start gap-2 text-sm text-text">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                    />
                    {requirement.label}
                  </li>
                ))}
              </ul>
              <p className="text-meta text-text-muted">
                These come from the retrieved call. Open the official page before you rely on the
                exact list.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="deadline" className="pt-4">
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-card-title font-semibold text-text">Deadline</h2>
              <DeadlineLine deadline={opportunity.deadline} />

              {opportunity.deadline.conflicts.length > 0 ? (
                <div className="rounded-card border border-warning/30 bg-warning-surface p-4">
                  <h3 className="text-sm font-semibold text-warning">Deadline conflict</h3>
                  <p className="mt-1 text-sm text-warning/90">
                    Two sources show different dates. We have not marked this deadline as safe.
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {opportunity.deadline.conflicts.map((conflict) => (
                      <li key={conflict.sourceId} className="text-sm text-warning/90">
                        <span className="font-medium">{conflict.value}</span>{' '}
                        <a
                          href={conflict.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline underline-offset-2"
                        >
                          — second source
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </TabsContent>

          <TabsContent value="evidence" className="pt-4">
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-card-title font-semibold text-text">Source references</h2>
                {evidence.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setEvidenceOpen(true)}>
                    Open drawer
                  </Button>
                ) : null}
              </div>
              {evidence.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No claim has been backed by a retrieved source for this opportunity.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {evidence.map((item) => (
                    <li key={item.id} className="rounded-card border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.quality === 'official' ? 'success' : 'neutral'}>
                          {item.quality === 'official' ? 'Official source' : 'Secondary source'}
                        </Badge>
                        {item.stance === 'contradicts' ? (
                          <Badge tone="warning">Contradicts another source</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-text">{item.claim}</p>
                      <blockquote className="mt-1.5 border-l-2 border-border pl-3 text-sm text-text-muted italic">
                        “{item.excerpt}”
                      </blockquote>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-2 inline-block text-meta text-info underline-offset-2 hover:underline"
                      >
                        {item.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="plan" className="pt-4">
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-card-title font-semibold text-text">Application plan</h2>
              <p className="text-sm text-text-muted">
                Add this opportunity to your application workspace to get a checklist, a task list
                and a writing studio.
              </p>
              <Button asChild size="sm" className="self-start">
                <Link to={`/applications?opportunity=${opportunity.id}`}>
                  <Pencil aria-hidden="true" className="size-4" />
                  Add to my plan
                </Link>
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <EvidenceDrawer
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        evidence={evidence}
        sources={sources}
      />
    </>
  );
}
