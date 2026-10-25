import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Compass, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/feedback/banners';
import { EmptyState } from '@/components/feedback/states';
import { useToast } from '@/lib/hooks/use-toast';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { DocumentLibrary } from '@/components/profile/document-library';
import { FactCard } from '@/components/profile/fact-card';
import { FactDetail } from '@/components/profile/fact-detail';
import { ProfileCompletenessPanel } from '@/components/profile/profile-completeness';
import { ProfileSections } from '@/components/profile/profile-sections';
import { PASSPORT_SECTIONS, type SectionStatus } from '@/components/profile/passport-sections';
import { ReviewHistory } from '@/components/profile/review-history';
import { ProtectedDetails } from '@/components/profile/protected-details';
import { CountryIdentityBadge } from '@/components/resources/country-identity';
import { computeCompleteness } from '@/lib/completeness';
import {
  useDeleteDocument,
  useDocuments,
  useMissions,
  useProfile,
  useProfileImpact,
  useProfileRevisions,
  useUpdateDocument,
  useUpdateFact,
  useUploadDocument,
} from '@/lib/queries';
import type { Document, ProfileFact } from '@/lib/schemas';

/**
 * The profile passport.
 *
 * Everything Oppulse knows about the student, where it came from, what it
 * is used for, and what the student has decided it may use. The layout is
 * three zones on a wide screen and collapses cleanly below that.
 */
export function ProfilePassportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const { data: profile } = useProfile();
  const { data: impact } = useProfileImpact();
  const { data: revisions } = useProfileRevisions();
  const { data: documents } = useDocuments();
  const { data: missions } = useMissions();

  const updateFact = useUpdateFact();
  const updateDocument = useUpdateDocument();
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  const [activeSection, setActiveSection] = useState('about');
  const [selectedFactId, setSelectedFactId] = useState<string | null>(searchParams.get('fact'));

  // Only one section navigation is rendered, so there is exactly one
  // navigation landmark and no duplicated controls.
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const facts = useMemo(() => profile?.facts ?? [], [profile]);
  const completeness = useMemo(() => computeCompleteness(profile), [profile]);

  const impactByFact = useMemo(() => {
    const map = new Map<
      string,
      {
        opportunityId: string;
        requirementId: string;
        opportunityTitle: string;
        requirementLabel: string;
        status: string;
      }[]
    >();
    for (const entry of impact?.impact ?? []) {
      map.set(entry.factKey, entry.requirements);
    }
    return map;
  }, [impact]);

  const selectedFact = facts.find((fact) => fact.id === selectedFactId) ?? null;
  const nationalityFact = facts.find((fact) => fact.key === 'nationality');

  const statusBySection = useMemo(() => {
    const status: Record<string, SectionStatus> = {};

    for (const section of PASSPORT_SECTIONS) {
      if (section.id === 'documents') {
        const pending = (documents?.documents ?? []).filter(
          (document) => document.status === 'needs_review',
        ).length;
        status[section.id] = pending > 0 ? 'pending' : 'ok';
        continue;
      }

      if (section.id === 'history') {
        status[section.id] = (revisions?.revisions.length ?? 0) > 0 ? 'ok' : 'empty';
        continue;
      }

      if (section.id === 'preferences') {
        const mission = missions?.missions[0];
        status[section.id] = mission ? 'ok' : 'empty';
        continue;
      }

      if (section.id === 'protected') {
        // The protected details are always something to look at, never
        // something to chase: the date is either given or deliberately not.
        status[section.id] = 'ok';
        continue;
      }

      const sectionFacts = facts.filter((fact) => fact.section === section.id);
      if (sectionFacts.length === 0) {
        status[section.id] = 'empty';
        continue;
      }
      const pending = sectionFacts.some((fact) => fact.status !== 'confirmed' || fact.excluded);
      status[section.id] = pending ? 'pending' : 'ok';
    }

    return status;
  }, [facts, documents, revisions, missions]);

  const selectFact = (fact: ProfileFact) => {
    setSelectedFactId(fact.id);
    setActiveSection(fact.section);
    const next = new URLSearchParams(searchParams);
    next.set('fact', fact.id);
    setSearchParams(next, { replace: true });
  };

  const clearFact = () => {
    setSelectedFactId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('fact');
    setSearchParams(next, { replace: true });
  };

  const factAction = (payload: { id: string } & Record<string, unknown>) => {
    updateFact.mutate(payload, {
      onError: () =>
        toast({
          tone: 'error',
          title: 'We could not save that change',
          description: 'Nothing was changed. Try again.',
        }),
    });
  };

  const activeMission = missions?.missions[0];

  const sectionContent = (() => {
    switch (activeSection) {
      case 'about':
        return (
          <Section
            id="about"
            title="About me"
            description="The details you have chosen to use when assessing opportunities."
          >
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 via-surface to-surface p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-semibold text-white shadow-sm"
                  >
                    {initialsFor(profile?.fullName ?? '')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-card-title font-semibold text-text">
                      {profile?.fullName ?? 'Your name'}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {profile?.headline ??
                        'Add a short headline to help opportunities find your direction.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-text-muted">
                      <span>{profile?.email ?? 'No email added'}</span>
                      {nationalityFact?.code && nationalityFact.value ? (
                        <CountryIdentityBadge
                          country={{
                            iso2: nationalityFact.code,
                            name: nationalityFact.value,
                            kind: 'country',
                            region: null,
                          }}
                          size="xs"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
                <ProfileSummary label="Profile status" value={completeness.summary} />
                <ProfileSummary
                  label="Last updated"
                  value={
                    profile?.updatedAt
                      ? new Date(profile.updatedAt).toLocaleDateString('en-GB', {
                          dateStyle: 'medium',
                        })
                      : 'Not yet'
                  }
                />
              </div>
            </Card>
            <FactGroup
              facts={facts.filter((fact) => fact.section === 'about')}
              selectedId={selectedFactId}
              onSelect={selectFact}
            />
          </Section>
        );

      case 'preferences':
        return (
          <Section id="preferences" title="Destinations and funding">
            {activeMission ? (
              <Card className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <span className="text-meta font-medium text-text-muted">Where</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeMission.criteria.destinations.map((destination) => (
                      <Badge key={destination} tone="info">
                        {destination}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-meta font-medium text-text-muted">
                    What funding must cover
                  </span>
                  <span className="text-sm text-text">
                    {activeMission.criteria.fundingPreference === 'fully_funded'
                      ? 'Fully funded — I cannot contribute to the cost.'
                      : activeMission.criteria.fundingPreference === 'partial_ok'
                        ? 'Partial funding is fine if the gap is small and stated.'
                        : 'Show everything, and explain the cost.'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-meta font-medium text-text-muted">Start period</span>
                  <span className="text-sm text-text">{activeMission.criteria.startPeriod}</span>
                </div>

                <Button asChild variant="outline" size="sm" className="self-start">
                  <Link to="/goals">
                    <Target aria-hidden="true" className="size-4" />
                    Change these in your mission
                  </Link>
                </Button>
              </Card>
            ) : (
              <EmptyState
                icon={<Compass className="size-5" />}
                title="No targets yet"
                description="Tell Oppulse where you want to go and what funding needs to cover, and it will search to match."
                action={
                  <Button asChild size="sm">
                    <Link to="/goals">Create a mission</Link>
                  </Button>
                }
              />
            )}
          </Section>
        );

      case 'documents':
        return (
          <Section
            id="documents"
            title="CV and documents"
            description="Upload the materials you want to use. You decide which documents may support your opportunity matches."
          >
            <DocumentLibrary
              documents={documents?.documents ?? []}
              onUpload={(file) =>
                uploadDocument.mutate(file, {
                  onSuccess: () =>
                    toast({
                      tone: 'info',
                      title: 'Document received',
                      description: 'We are reading it now.',
                    }),
                  onError: () =>
                    toast({
                      tone: 'error',
                      title: 'We could not upload that file',
                      description: 'Nothing was saved. Try again.',
                    }),
                })
              }
              onToggleConsent={(document: Document, consentToUse: boolean) =>
                updateDocument.mutate(
                  { id: document.id, consentToUse },
                  {
                    onSuccess: () =>
                      toast({
                        tone: 'success',
                        title: consentToUse
                          ? 'Oppulse may use this document'
                          : 'Document excluded from AI context',
                      }),
                    onError: () =>
                      toast({
                        tone: 'error',
                        title: 'We could not change that',
                        description: 'Nothing was changed. Try again.',
                      }),
                  },
                )
              }
              onDelete={(document: Document) =>
                deleteDocument.mutate(document.id, {
                  onSuccess: () =>
                    toast({
                      tone: 'info',
                      title: 'Document deleted',
                      description:
                        'Facts extracted from it are no longer used, unless you confirmed them separately.',
                    }),
                  onError: () =>
                    toast({
                      tone: 'error',
                      title: 'We could not delete that document',
                      description: 'Nothing was changed. Try again.',
                    }),
                })
              }
              pendingDocumentId={updateDocument.isPending ? updateDocument.variables.id : null}
              uploading={uploadDocument.isPending}
              deletingDocumentId={deleteDocument.isPending ? deleteDocument.variables : null}
            />
          </Section>
        );

      case 'protected':
        return (
          <Section
            id="protected"
            title="Protected details"
            description="Sensitive personal data, kept apart from your profile facts and used for one purpose only."
          >
            <ProtectedDetails />
          </Section>
        );

      case 'history':
        return (
          <Section
            id="history"
            title="Review history"
            description="Every change you made, with the value before and after."
          >
            <ReviewHistory revisions={revisions?.revisions ?? []} />
          </Section>
        );

      default: {
        const section = PASSPORT_SECTIONS.find((entry) => entry.id === activeSection);
        return (
          <Section id={activeSection} title={section?.label ?? 'Profile'}>
            <FactGroup
              facts={facts.filter((fact) => fact.section === activeSection)}
              selectedId={selectedFactId}
              onSelect={selectFact}
            />
          </Section>
        );
      }
    }
  })();

  const detail = selectedFact ? (
    <FactDetail
      fact={selectedFact}
      blockedRequirements={impactByFact.get(selectedFact.key) ?? []}
      pending={updateFact.isPending}
      onConfirm={() => factAction({ id: selectedFact.id, status: 'confirmed' })}
      onCorrect={(value) => factAction({ id: selectedFact.id, value })}
      onExclude={() => factAction({ id: selectedFact.id, excluded: true })}
      onRestore={() => factAction({ id: selectedFact.id, excluded: false })}
      onReject={() => factAction({ id: selectedFact.id, status: 'rejected' })}
    />
  ) : (
    <Card className="flex flex-col items-center gap-2 p-8 text-center">
      <p className="text-sm font-medium text-text">Select a fact</p>
      <p className="max-w-xs text-sm text-text-muted">
        Its provenance, what it is used for, and what it is holding up will appear here.
      </p>
      <Button variant="ghost" size="sm" onClick={clearFact} className="hidden">
        Clear
      </Button>
    </Card>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My profile"
        description="Keep your experience, education and supporting documents ready for better-matched opportunities."
      />

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        {isDesktop ? (
          <aside className="lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div className="flex flex-col gap-4">
              <ProfileCompletenessPanel completeness={completeness} />
              <Card className="p-2">
                <ProfileSections
                  sections={PASSPORT_SECTIONS}
                  statusById={statusBySection}
                  activeId={activeSection}
                  onSelect={setActiveSection}
                />
              </Card>
            </div>
          </aside>
        ) : (
          <div className="lg:hidden">
            <ProfileSections
              sections={PASSPORT_SECTIONS}
              statusById={statusBySection}
              activeId={activeSection}
              onSelect={setActiveSection}
              variant="chips"
            />
          </div>
        )}

        <div className="min-w-0 lg:col-start-2 lg:row-start-2 2xl:col-start-2 2xl:row-start-1">
          {sectionContent}
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1 2xl:sticky 2xl:top-6 2xl:col-start-3 2xl:row-span-2 2xl:row-start-1 2xl:self-start">
          {detail}
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-section font-semibold text-text">{title}</h2>
        {description ? <p className="max-w-2xl text-sm text-text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function FactGroup({
  facts,
  selectedId,
  onSelect,
}: {
  facts: ProfileFact[];
  selectedId: string | null;
  onSelect: (fact: ProfileFact) => void;
}) {
  if (facts.length === 0) {
    return (
      <EmptyState
        icon={<Compass className="size-5" />}
        title="Nothing here yet"
        description="Upload a document and Oppulse will propose what it finds for you to confirm."
        action={
          <Button asChild size="sm">
            <Link to="/documents">Upload a document</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {facts.map((fact) => (
        <FactCard key={fact.id} fact={fact} selected={fact.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function ProfileSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button bg-surface-subtle px-3 py-2.5">
      <p className="text-meta font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text">{value}</p>
    </div>
  );
}

function initialsFor(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}
