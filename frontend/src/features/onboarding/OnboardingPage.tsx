import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileSearch, Link2, MessageSquareText, Sparkles, Upload } from 'lucide-react';
import { AdaptiveProgress } from '@/components/onboarding/adaptive-progress';
import { IntentCard } from '@/components/onboarding/intent-card';
import { MissionPreview } from '@/components/onboarding/mission-preview';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { QuestionStep } from '@/components/onboarding/question-step';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/feedback/banners';
import { useToast } from '@/lib/hooks/use-toast';
import { ONBOARDING_QUESTIONS } from '@/lib/onboarding/questions';
import { deriveMissionPreview, hydrateAnswers, nextQuestionId } from '@/lib/onboarding/engine';
import {
  useCompleteOnboarding,
  useDiscoverOpportunities,
  useDocuments,
  useOnboardingDraft,
  useProfile,
  useSaveOnboardingDraft,
  useUploadDocument,
} from '@/lib/queries';
import type {
  AnswerValue,
  IntentChoice,
  OnboardingDraft,
  QuestionId,
} from '@/lib/schemas/onboarding';

const EMPTY_DRAFT: OnboardingDraft = {
  id: 'd1000000-0000-4000-8000-000000000002',
  intent: null,
  referenceUrl: null,
  answers: [],
  uploadedDocumentId: null,
  uploadedDocumentStatus: null,
  uploadedDocumentConsent: null,
  currentQuestionId: 'goal',
  completed: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Onboarding.
 *
 * The whole flow is derived from one draft, so a refresh restores exactly
 * where the user was, and every answer can be changed without losing the
 * rest. The user never writes the mission — they answer questions and
 * review the mission Oppulse derives from them.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: draftData } = useOnboardingDraft();
  const { data: profile } = useProfile();
  const { data: documents } = useDocuments();
  const saveDraft = useSaveOnboardingDraft();
  const uploadDocument = useUploadDocument();
  const complete = useCompleteOnboarding();
  const discover = useDiscoverOpportunities();

  const [referenceUrl, setReferenceUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const draft = useMemo(() => {
    const base = draftData?.draft ?? EMPTY_DRAFT;
    if (!profile) return base;
    return hydrateAnswers(base, profile);
  }, [draftData, profile]);

  const answers = draft.answers;
  const answerMap = useMemo(() => {
    const map: Record<string, AnswerValue | undefined> = {};
    for (const answer of answers) map[answer.questionId] = answer.value;
    return map;
  }, [answers]);

  const currentQuestionId = nextQuestionId(answers);
  const inferredCount = answers.filter((answer) => answer.source !== 'user').length;

  const preview = useMemo(
    () => (profile ? deriveMissionPreview(draft, profile) : null),
    [draft, profile],
  );

  const persist = (mutate: (current: OnboardingDraft) => OnboardingDraft) => {
    const next: OnboardingDraft = {
      ...mutate(draft),
      updatedAt: new Date().toISOString(),
    };
    saveDraft.mutate(next);
  };

  const setIntent = (intent: IntentChoice) => {
    persist((current) => ({ ...current, intent }));
  };

  const setAnswer = (questionId: QuestionId, value: AnswerValue) => {
    persist((current) => {
      const existing = current.answers.filter((answer) => answer.questionId !== questionId);
      return {
        ...current,
        answers: [
          ...existing,
          {
            questionId,
            value,
            answeredAt: new Date().toISOString(),
            source: 'user' as const,
            factKey: null,
            note: null,
          },
        ],
      };
    });
  };

  const skipQuestion = () => {
    if (!currentQuestionId) return;
    persist((current) => ({
      ...current,
      answers: current.answers.filter((answer) => answer.questionId !== currentQuestionId),
    }));
  };

  const onFileSelected = (file: File | undefined) => {
    if (!file || uploadDocument.isPending) return;

    const accepted = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!accepted.includes(file.type)) {
      toast({
        tone: 'error',
        title: 'That file type is not supported',
        description: 'Upload a PDF or a Word document. Anything else is not read by the agent.',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        tone: 'error',
        title: 'That file is too large',
        description: 'The limit is 10 MB. Compress the file or upload a smaller version.',
      });
      return;
    }

    // The response is part of the contract: the document id and its
    // reading state are what the draft records, so a refresh — or another
    // device — resumes from the same document. The hook supplies a fresh
    // idempotency key per selection, so a retry cannot double-upload.
    uploadDocument.mutate(file, {
      onSuccess: (document) => {
        persist((current) => ({
          ...current,
          uploadedDocumentId: document.id,
          uploadedDocumentStatus: document.status,
          uploadedDocumentConsent: document.consentToUse,
        }));
        toast({
          tone: 'info',
          title: 'Document received',
          description:
            'We are reading it now. The facts we find will appear in your profile for you to confirm.',
        });
      },
      onError: () => {
        toast({
          tone: 'error',
          title: 'We could not upload that file',
          description: 'Nothing was saved. Try again in a moment.',
        });
      },
    });
  };

  const onRun = () => {
    if (complete.isPending || discover.isPending) return;
    complete.mutate(draft, {
      onSuccess: () => {
        if (!preview) {
          void navigate('/home');
          return;
        }
        discover.mutate(preview.objective, {
          onSuccess: () => {
            void navigate('/home');
          },
          onError: () => {
            toast({
              tone: 'error',
              title: 'We could not search live opportunities',
              description: 'Your answers are saved. Try the search again in a moment.',
            });
          },
        });
      },
      onError: () => {
        toast({
          tone: 'error',
          title: 'We could not start the research run',
          description: 'Your answers are saved. Try again in a moment.',
        });
      },
    });
  };

  const usedDocuments = (documents?.documents ?? [])
    .filter((document) => preview?.usedDocumentIds.includes(document.id))
    .map((document) => ({ id: document.id, filename: document.filename }));

  const intentFromUrl = searchParams.get('intent');
  const effectiveIntent: IntentChoice | null =
    draft.intent ??
    (intentFromUrl === 'materials' || intentFromUrl === 'link' ? intentFromUrl : null);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-[10px] bg-primary/12 text-primary"
            >
              <Sparkles className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm leading-tight font-semibold text-text">Oppulse AI</span>
              <span className="text-meta leading-tight text-text-muted">
                Opportunity Action Agent
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-meta text-text-muted sm:inline">
              Your answers are saved as you go
            </span>
            <Button asChild variant="ghost" size="sm">
              <Link to="/home">Skip to workspace</Link>
            </Button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6"
      >
        <PageHeader
          title="Let Oppulse get to know you"
          description="A few questions, and I will build the search that fits you. Anything your documents already answer, I will take from there."
        />

        <OnboardingShell
          aside={
            <div className="flex flex-col gap-4">
              <Card className="flex flex-col gap-4 p-5">
                <AdaptiveProgress
                  answeredCount={answers.length}
                  totalCount={ONBOARDING_QUESTIONS.length}
                  inferredCount={inferredCount}
                />
              </Card>

              <Card className="flex flex-col gap-2 p-5">
                <h2 className="text-sm font-semibold text-text">What I know about you</h2>
                {profile &&
                profile.facts.filter((fact) => fact.status === 'confirmed').length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {profile.facts
                      .filter((fact) => fact.status === 'confirmed')
                      .slice(0, 4)
                      .map((fact) => (
                        <li key={fact.id} className="text-meta text-text-muted">
                          <span className="font-medium text-text">{fact.label}:</span> {fact.value}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">
                    Nothing yet. Answer the questions below, or upload a document and I will propose
                    what I find.
                  </p>
                )}
                <p className="text-meta text-text-muted">
                  Only confirmed facts are ever used, and you can exclude any of them.
                </p>
              </Card>
            </div>
          }
        >
          {!effectiveIntent ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-card-title font-semibold text-text">
                  How would you like to start?
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  This only sets the first step. You can switch at any time.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <IntentCard
                  icon={MessageSquareText}
                  title="Tell Oppulse what you need"
                  description="Describe a goal in your own words and I will build the search from it."
                  bestFor="you have a goal but no specific call in mind"
                  selected={draft.intent === 'goal'}
                  onSelect={() => setIntent('goal')}
                />
                <IntentCard
                  icon={Upload}
                  title="Upload my CV and documents"
                  description="I will read them, propose what I find, and you confirm what is true."
                  bestFor="you want your profile organised first"
                  selected={draft.intent === 'materials'}
                  onSelect={() => setIntent('materials')}
                />
                <IntentCard
                  icon={Link2}
                  title="I already found an opportunity"
                  description="Paste the link and I will read the call and check it against you."
                  bestFor="you have a specific programme in mind"
                  selected={draft.intent === 'link'}
                  onSelect={() => setIntent('link')}
                />
              </div>
            </div>
          ) : effectiveIntent === 'materials' && !draft.uploadedDocumentId ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-card-title font-semibold text-text">Upload your documents</h2>
                <p className="mt-1 text-sm text-text-muted">
                  A CV is the quickest way to make my recommendations accurate. Transcripts and
                  language certificates let me check more requirements for you.
                </p>
              </div>

              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                accept=".pdf,.docx"
                onChange={(event) => {
                  onFileSelected(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />

              <button
                type="button"
                disabled={uploadDocument.isPending}
                onClick={() => fileInput.current?.click()}
                className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-border bg-surface p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-55"
              >
                <FileSearch aria-hidden="true" className="size-8 text-primary" />
                <span className="text-sm font-medium text-text">
                  {uploadDocument.isPending ? 'Uploading…' : 'Drop a file here, or choose one'}
                </span>
                <span className="text-meta text-text-muted">PDF or Word, up to 10 MB</span>
              </button>

              <Button variant="ghost" onClick={() => setIntent('goal')}>
                Skip for now — I will just answer the questions
              </Button>
            </div>
          ) : effectiveIntent === 'link' && !draft.referenceUrl ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-card-title font-semibold text-text">
                  Paste the opportunity link
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  I will read the official page, extract the requirements and funding, and check
                  them against your profile.
                </p>
              </div>

              <label htmlFor="reference-url" className="text-sm font-medium text-text">
                Link to the programme or call
              </label>
              <Input
                id="reference-url"
                type="url"
                value={referenceUrl}
                onChange={(event) => setReferenceUrl(event.target.value)}
                placeholder="https://example.org/programmes/scholarship"
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={!/^https?:\/\/.+/i.test(referenceUrl)}
                  loading={saveDraft.isPending}
                  loadingLabel="Saving…"
                  onClick={() =>
                    persist((current) => ({ ...current, referenceUrl: referenceUrl.trim() }))
                  }
                >
                  Use this link
                </Button>
                <Button variant="ghost" onClick={() => setIntent('goal')}>
                  Skip for now
                </Button>
              </div>
            </div>
          ) : showPreview && preview ? (
            <MissionPreview
              preview={preview}
              questions={ONBOARDING_QUESTIONS}
              answers={answerMap}
              usedDocuments={usedDocuments}
              onEditAnswer={setAnswer}
              onRun={onRun}
              onBack={() => setShowPreview(false)}
              running={complete.isPending || discover.isPending}
            />
          ) : currentQuestionId ? (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-card-title font-semibold text-text">
                  {
                    ONBOARDING_QUESTIONS.find((question) => question.id === currentQuestionId)
                      ?.prompt
                  }
                </h2>
              </div>
              <QuestionStep
                key={currentQuestionId}
                question={
                  ONBOARDING_QUESTIONS.find((question) => question.id === currentQuestionId) ??
                  ONBOARDING_QUESTIONS[0]!
                }
                value={answerMap[currentQuestionId]}
                submitting={saveDraft.isPending}
                onAnswer={(value) => setAnswer(currentQuestionId, value)}
                onSkip={
                  ONBOARDING_QUESTIONS.find((question) => question.id === currentQuestionId)
                    ?.skippable
                    ? skipQuestion
                    : undefined
                }
              />
              <Button variant="ghost" onClick={() => setShowPreview(true)} className="self-start">
                Skip the rest and show me the mission
              </Button>
            </div>
          ) : preview ? (
            <MissionPreview
              preview={preview}
              questions={ONBOARDING_QUESTIONS}
              answers={answerMap}
              usedDocuments={usedDocuments}
              onEditAnswer={setAnswer}
              onRun={onRun}
              onBack={() => setShowPreview(false)}
              running={complete.isPending || discover.isPending}
            />
          ) : null}
        </OnboardingShell>
      </main>
    </div>
  );
}
