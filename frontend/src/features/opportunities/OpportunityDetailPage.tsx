import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  CalendarClock,
  Check,
  Clock,
  ExternalLink,
  GraduationCap,
  MapPin,
  MessageSquareText,
  Scale,
  X,
} from 'lucide-react';
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
import { CompareDialog } from './CompareDialog';
import { ApiError } from '@/lib/api/errors';
import { useAgent } from '@/lib/agent-context';
import { cn } from '@/lib/cn';
import {
  useCreateApplication,
  useOpportunity,
  useProfile,
  useSession,
  useToggleSaveOpportunity,
} from '@/lib/queries';
import { useToast } from '@/lib/hooks/use-toast';
import {
  FUNDING_COVERAGE_LABEL,
  OPPORTUNITY_TYPE_LABEL,
} from '@/lib/opportunity-labels';

/* "research internship" -> "Research Internship". */
function capitaliseWords(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

/* Deep opportunity analysis.
 * The page orders what matters by importance: title and source, the five
 * labelled concepts (fit, eligibility, funding, competition, confidence), then
 * the detail tabs. Fit is always labelled a profile match, never an
 * admission probability, and every high-stakes claim keeps a path to its
 * evidence (spec §6.5).
 */
export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setContext } = useAgent();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const { data, isPending, error, refetch } = useOpportunity(id ?? null);
  const { data: profile } = useProfile();
  const toggleSave = useToggleSaveOpportunity();
  const createApplication = useCreateApplication();

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

  const { opportunity, match, evidence, sources, applicationId } = data;
  const fullyFunded = opportunity.funding.coverage === 'fully_funded';

  /* Real highlights: funding coverage, confirmed funding lines, fit reasons. */
  const uniqueHighlights = [
    ...(fullyFunded ? [FUNDING_COVERAGE_LABEL[opportunity.funding.coverage]] : []),
    ...opportunity.funding.components
      .filter((component) => component.status === 'confirmed' && component.label)
      .map((component) => component.label),
    ...(match?.reasons ?? []),
  ].filter((h, i, self) => self.indexOf(h) === i).slice(0, 5);

  /* Show highlights conditionally. */
  const hasHighlights = uniqueHighlights.length > 0;

  const startApplication = () => {
    if (applicationId) return;
    if (!session) {
      void navigate(
        `/auth/sign-up?next=${encodeURIComponent(`/applications?opportunity=${opportunity.id}`)}`,
      );
      return;
    }
    createApplication.mutate(opportunity.id, {
      onSuccess: (application) => void navigate(`/applications/${application.id}`),
      onError: () =>
        toast({
          tone: 'error',
          title: 'We could not create the workspace',
          description: 'Nothing was changed. Try again.',
        }),
    });
  };

  const handleSaveToggle = () => {
    // $
    try {
      toggleSave.mutate(opportunity.id, {
        onError: () =>
          toast({
            tone: 'error',
            title: 'We could not update your list',
            description: 'Nothing was changed. Try again.',
          }),
        onSuccess: () =>
          toast({
            tone: 'success',
            title: opportunity.saved ? 'Removed from your list' : 'Saved to your list',
          }),
      });
    } catch {
      toast({
        tone: 'error',
        title: 'We could not update your list',
        description: 'Nothing was changed. Try again.',
      });
    }
  };

  const askOppulse = () => {
    setContext({ opportunityId: opportunity.id });
    void navigate('/assistant');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/opportunities">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to results
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Close this opportunity and return to results"
        >
          <Link to="/opportunities">
            <X aria-hidden="true" className="size-5" />
          </Link>
        </Button>
      </div>

      <div className="relative">
        <OpportunityBanner
          brand={opportunity.institutionBrand}
          programmeTitle={capitaliseWords(OPPORTUNITY_TYPE_LABEL[opportunity.type])}
          className="aspect-[1200/400] w-full"
        />
        {fullyFunded ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-meta font-semibold text-success shadow-[0_2px_8px_rgb(11_23_48/0.25)]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
            Fully funded
          </span>
        ) : null}
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <InstitutionLogo brand={opportunity.institutionBrand} size={48} source="asset" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{opportunity.institution}</span>
            <CountryIdentityBadge country={opportunity.country} size="xs" />
          </div>
        </div>

        <h1 className="max-w-3xl text-page-title font-semibold tracking-tight text-text">
          {opportunity.title}
        </h1>

        <ul className="flex flex-wrap items-center gap-2">
          <HeaderChip icon={MapPin} label="Country">
            {opportunity.country.name}
          </HeaderChip>
          <HeaderChip icon={GraduationCap} label="Type">
            {OPPORTUNITY_TYPE_LABEL[opportunity.type]}
          </HeaderChip>
          {opportunity.duration ? (
            <HeaderChip icon={Clock} label="Duration">
              {opportunity.duration}
            </HeaderChip>
          ) : null}
          <li>
            <a
              href={opportunity.canonicalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-meta font-medium text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Official call
              <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          </li>
        </ul>
      </header>

      <Card className="flex flex-wrap items-start gap-x-8 gap-y-5 p-5">
        <div className="flex flex-col items-center gap-1">
          {match ? (
            <FitScore match={match} />
          ) : (
            <>

              <span className="grid size-16 place-items-center rounded-full bg-surface-subtle text-sm font-semibold text-text-muted">
                —
              </span>
              <span className="text-meta text-text-muted">Not assessed</span>
            </>
          )}
        </div>

        <Concept label="Eligibility">
          {match ? (
            <EligibilitySummary eligibility={match.eligibility} />
          ) : (
            <span className="text-sm text-text-muted">Not assessed</span>
          )}
        </Concept>

        <Concept label="Competition">
          {match ? (
            <CompetitivenessBadge value={match.competitiveness} />
          ) : (
            <span className="text-sm text-text-muted">Unknown</span>
          )}
        </Concept>

        <Concept label="Confidence">
          {match ? (
            <ConfidenceBadge value={match.confidence} />
          ) : (
            <span className="text-sm text-text-muted">Unknown</span>
          )}
        </Concept>

        <Concept label="Deadline">
          <DeadlineLine deadline={opportunity.deadline} />
        </Concept>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="funding">Funding</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4 pt-4">
          <Card className="p-5">
            <h2 className="text-card-title font-semibold text-text">AI overview</h2>
            <p className="mt-2 text-sm leading-relaxed text-text">{opportunity.summary}</p>

            {hasHighlights ? (
              <div className="mt-4 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-text">Why it fits</h3>
                <ul className="flex flex-col gap-1.5">
                  {match?.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-sm text-text">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success"
                      />
                      {reason}
                    </li>
                  ))}
                </ul>
                {// eslint-disable-line @typescript-eslint/no-unnecessary-condition
(match?.warnings?.length ?? 0) > 0 ? (
                  <>
                    <h3 className="text-sm font-semibold text-text">What to verify</h3>
                    <ul className="flex flex-col gap-1.5">
                      {match?.warnings.map((warning) => (
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
            ) : (
              <p className="mt-4 text-sm text-text-muted">
                No highlights yet — the assessment has not produced reasons for this opportunity.
              </p>
            )}

            {hasHighlights && (
              <ul className="mt-3 flex flex-col gap-2">
                {uniqueHighlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2.5 text-sm text-text">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-success"
                    />
                    {highlight}
                  </li>
                ))}
              </ul>
            )}

            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
                <CalendarClock aria-hidden="true" className="size-4 text-text-muted" />
                Important dates
              </h2>
              <div className="mt-3">
                <DeadlineLine deadline={opportunity.deadline} />
              </div>

              {opportunity.applicationOpensAt ? (
                <p className="mt-2 text-sm text-text-muted">
                  Applications open{' '}
                  {new Date(opportunity.applicationOpensAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  .
                </p>
              ) : null}

              {opportunity.deadline.conflicts.length > 0 ? (
                <div className="mt-3 rounded-card border border-warning/30 bg-warning-surface p-4">
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

              <p className="mt-3 text-meta text-text-muted">
                Dates come from the retrieved call. Open the official page before you rely on them.
              </p>
            </Card>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-card-title font-semibold text-text">
              <Check aria-hidden="true" className="size-4 text-success" />
              Key highlights
            </h2>
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
                      " {requirement.sourceClause}"
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

        <TabsContent value="sources" className="pt-4">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-card-title font-semibold text-text">Sources</h2>
              {evidence.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setEvidenceOpen(true)}>
                  Open drawer
                </Button>
              )}
              {evidence.length === 0 && (
                <p className="text-sm text-text-muted">
                  No claim has been backed by a retrieved source for this opportunity.
                </p>
              )}
            </div>
            {evidence.length > 0 && (
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
                      " {item.excerpt}"
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

            {evidence.length === 0 && (
              <p className="text-sm text-text-muted">
                No claim has been backed by a retrieved source for this opportunity.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-4 z-30">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface/95 p-3 shadow-popover backdrop-blur">
          <p className="hidden text-meta text-text-muted xl:block">
            Profile match describes how well your confirmed profile fits this call — it is not an
            admission probability.
          </p>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {session ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToggle}
                className="sm:size-auto"
              >
                <Bookmark
                  aria-hidden="true"
                  className={cn('size-4', opportunity.saved && 'fill-current')}
                />
                {opportunity.saved ? 'Saved' : 'Save'}
              </Button>
            ) : null}

            {session ? (
              <Button
                variant="outline"
                size="sm"
                disabled={toggleSave.isPending}
                aria-pressed={opportunity.saved}
                onClick={askOppulse}
                className="sm:size-auto"
              >
                <MessageSquareText aria-hidden="true" className="size-4" />
                Ask Oppulse
              </Button>
            ) : null}

            {session ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompareOpen(true)}
                className="sm:size-auto"
              >
                <Scale aria-hidden="true" className="size-4" />
                Compare
              </Button>
            ) : null}

            {applicationId ? (
              <Button asChild size="sm">
                <Link to={`/applications/${applicationId}`}>
                  <Check aria-hidden="true" className="size-4" />
                  Open workspace
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                loading={createApplication.isPending}
                loadingLabel="Creating…"
                onClick={startApplication}
              >
                {session ? 'Start application' : 'Create a plan'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <EvidenceDrawer
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        evidence={evidence}
        sources={sources}
      />

      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        currentId={opportunity.id}
      />
    </div>
  );
}

/* One labelled concept from the assessment strip. */
function Concept({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-meta font-medium text-text-muted">{label}</span>
      {children}
    </div>
  );
}

/* A header fact: icon, value, and what the value means. */
function HeaderChip({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-1.5">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
      <span className="text-meta font-medium text-text">{children}</span>
      <span className="text-meta text-text-muted">{label}</span>
    </li>
  );
}
