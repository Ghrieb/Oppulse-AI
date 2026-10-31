import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Compass, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { PageHeader } from '@/components/feedback/banners';
import { Skeleton } from '@/components/ui/tooltip';
import { OpportunityCard } from '@/components/opportunities/opportunity-card';
import { useToast } from '@/lib/hooks/use-toast';
import {
  useCreateApplication,
  useDiscoverOpportunities,
  useDismissOpportunity,
  useOpportunities,
  useSession,
  useToggleSaveOpportunity,
} from '@/lib/queries';
import { cn } from '@/lib/cn';

const FUNDING_FILTERS = [
  { id: 'all', label: 'All funding' },
  { id: 'fully_funded', label: 'Fully funded' },
  { id: 'partial', label: 'Partially funded' },
  { id: 'unknown', label: 'Funding unknown' },
] as const;

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'research_internship', label: 'Internships' },
  { id: 'fellowship', label: 'Fellowships' },
  { id: 'scholarship', label: 'Scholarships' },
  { id: 'summer_school', label: 'Summer schools' },
] as const;

export function OpportunitiesPage() {
  const [funding, setFunding] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [discoveryRequest, setDiscoveryRequest] = useState('');
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useOpportunities();
  const { data: session } = useSession();
  const toggleSave = useToggleSaveOpportunity();
  const dismiss = useDismissOpportunity();
  const createApplication = useCreateApplication();
  const discover = useDiscoverOpportunities();
  const { toast } = useToast();

  const matches = data?.matches ?? [];

  const visible = useMemo(() => {
    const list = data?.opportunities ?? [];
    const needle = query.trim().toLowerCase();
    return list.filter((opportunity) => {
      if (funding !== 'all' && opportunity.funding.coverage !== funding) return false;
      if (type !== 'all' && opportunity.type !== type) return false;
      if (!needle) return true;
      return (
        opportunity.title.toLowerCase().includes(needle) ||
        opportunity.institution.toLowerCase().includes(needle) ||
        opportunity.country.name.toLowerCase().includes(needle)
      );
    });
  }, [data, funding, type, query]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Opportunities" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Opportunities"
        description={
          session
            ? 'Ranked against your confirmed profile. Every claim links back to the source it came from.'
            : 'Browse real opportunity details and evidence first. Create an account when you are ready to compare them with your CV.'
        }
      />

      {!session ? (
        <Card className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Exploring as a guest</p>
            <p className="text-sm text-text-muted">
              You can read opportunities and sources now. Sign in when you want to save, match your
              profile, or build an application plan.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/auth/sign-up">Create my workspace</Link>
          </Button>
        </Card>
      ) : null}

      {session ? (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-base font-semibold text-text">Find opportunities</h2>
            <p className="text-sm text-text-muted">
              Search official programme pages. We save up to three source-linked results.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="discovery-request" className="sr-only">
              What opportunities are you looking for?
            </label>
            <Input
              id="discovery-request"
              value={discoveryRequest}
              onChange={(event) => setDiscoveryRequest(event.target.value)}
              placeholder="Find fully funded Master's programmes in genetics in Europe"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && discoveryRequest.trim().length >= 10) {
                  discover.mutate(discoveryRequest.trim(), {
                    onSuccess: (result) =>
                      setDiscoveryMessage(
                        result.opportunities.length
                          ? `${result.opportunities.length} ${result.opportunities.length === 1 ? 'opportunity' : 'opportunities'} saved.`
                          : 'No supported official opportunities were found. Try a more specific search.',
                      ),
                    onError: () => setDiscoveryMessage('Search failed. Please try again.'),
                  });
                }
              }}
            />
            <Button
              className="shrink-0"
              loading={discover.isPending}
              loadingLabel="Checking sources…"
              disabled={discoveryRequest.trim().length < 10}
              onClick={() =>
                discover.mutate(discoveryRequest.trim(), {
                  onSuccess: (result) =>
                    setDiscoveryMessage(
                      result.opportunities.length
                        ? `${result.opportunities.length} ${result.opportunities.length === 1 ? 'opportunity' : 'opportunities'} saved.`
                        : 'No supported official opportunities were found. Try a more specific search.',
                    ),
                  onError: () => setDiscoveryMessage('Search failed. Please try again.'),
                })
              }
            >
              <Search aria-hidden="true" className="size-4" />
              Find opportunities
            </Button>
          </div>
          {discoveryMessage ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-button border border-border bg-surface-subtle px-3 py-2.5 text-sm text-text-muted"
            >
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              <p>{discoveryMessage}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="opportunity-search" className="sr-only">
              Search opportunities
            </label>
            <Input
              id="opportunity-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, institution or destination"
              type="search"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <FilterGroup
            label="Funding"
            options={FUNDING_FILTERS}
            value={funding}
            onChange={setFunding}
          />
          <FilterGroup label="Type" options={TYPE_FILTERS} value={type} onChange={setType} />
        </div>
      </Card>

      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-96" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-5" />}
          title="No opportunities match these filters"
          description="Your search scope and filters are narrower than the available results. Broaden the filters, or edit the mission that produced them."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFunding('all');
                setType('all');
                setQuery('');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((opportunity) => {
            const match = matches.find((item) => item.opportunityId === opportunity.id) ?? null;
            return (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                match={match}
                saving={toggleSave.isPending}
                dismissing={dismiss.isPending}
                addingToApplication={createApplication.isPending}
                onToggleSave={
                  session
                    ? () => {
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
                              title: opportunity.saved
                                ? 'Removed from your list'
                                : 'Saved to your list',
                            }),
                        });
                      }
                    : undefined
                }
                onDismiss={
                  session
                    ? () => {
                        dismiss.mutate(
                          { id: opportunity.id },
                          {
                            onSuccess: () =>
                              toast({
                                tone: 'info',
                                title: 'Removed from your results',
                                description: 'We will use this to improve future recommendations.',
                              }),
                            onError: () =>
                              toast({
                                tone: 'error',
                                title: 'We could not remove that from your results',
                                description: 'Nothing was changed. Try again.',
                              }),
                          },
                        );
                      }
                    : undefined
                }
                onAddToApplication={
                  session
                    ? () => {
                        createApplication.mutate(opportunity.id, {
                          onSuccess: () =>
                            toast({
                              tone: 'success',
                              title: 'Added to your application workspace',
                              description: 'Open Applications to plan the next step.',
                            }),
                          onError: () =>
                            toast({
                              tone: 'error',
                              title: 'We could not create the workspace',
                              description: 'Nothing was changed. Try again.',
                            }),
                        });
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-meta font-medium text-text-muted">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            'min-h-9 rounded-full border px-3 text-meta font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            value === option.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-surface text-text-muted hover:bg-surface-subtle',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
