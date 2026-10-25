import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  FileSearch,
  Link2,
  MessageSquareText,
  Quote,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Landing page sections.
 *
 * The page has one job: make a visitor understand what Oppulse does and
 * why they would trust it, before asking them to register.
 */

export function LandingHero({
  onStart,
  onUpload,
  onAnalyse,
}: {
  onStart: () => void;
  onUpload: () => void;
  onAnalyse: () => void;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(91,75,242,0.16),transparent_70%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20">
        <Badge tone="primary" icon={<Sparkles />} className="self-start">
          Make your next move count
        </Badge>

        <div className="flex max-w-3xl flex-col gap-5">
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-text sm:text-5xl">
            Find the opportunities worth your time — and turn them into applications.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-text-muted">
            Oppulse turns scattered programme calls into a short, credible list of opportunities
            worth your time — with the requirements, real costs and next step clearly laid out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart}>
            <MessageSquareText aria-hidden="true" className="size-4" />
            Explore opportunities
          </Button>
          <Button size="lg" variant="outline" onClick={onUpload}>
            <Upload aria-hidden="true" className="size-4" />
            Upload my CV
          </Button>
          <Button size="lg" variant="ghost" onClick={onAnalyse}>
            <Link2 aria-hidden="true" className="size-4" />
            Analyse an opportunity
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-sm text-text-muted">
          <span className="inline-flex items-center gap-2">
            <FileSearch aria-hidden="true" className="size-4 text-primary" />
            Evidence attached to every important claim
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            Profile facts confirmed by you
          </span>
          <span className="inline-flex items-center gap-2">
            <Quote aria-hidden="true" className="size-4 text-primary" />
            You approve every change to your documents
          </span>
        </div>
      </div>
    </section>
  );
}

export function LandingProblem() {
  const problems = [
    {
      title: 'Too much to read',
      body: 'Important details are buried across eligibility clauses, funding notes and separate deadline pages.',
    },
    {
      title: 'Unclear fit',
      body: 'A promising title is not the same as a realistic match for your background and plans.',
    },
    {
      title: 'Costs hidden in the small print',
      body: '“Fully funded” can still leave travel, housing or insurance for you to cover.',
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-text">
          Finding a call is easy. Knowing whether it is worth applying is not.
        </h2>
        <p className="text-base leading-relaxed text-text-muted">
          Search results do not tell you whether you qualify, what “funded” really covers, or what
          needs to happen before the deadline. That work is where applications are won or lost.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {problems.map((problem) => (
          <Card key={problem.title} className="flex flex-col gap-2 p-5">
            <h3 className="text-card-title font-semibold text-text">{problem.title}</h3>
            <p className="text-sm leading-relaxed text-text-muted">{problem.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function LandingHowItWorks() {
  const steps = [
    {
      title: 'Start with your direction',
      body: 'Tell Oppulse what you are looking for. It asks only the questions needed to narrow the search.',
    },
    {
      title: 'Read the source material',
      body: 'It gathers the official pages, separates evidence from gaps, and tells you what could not be checked.',
    },
    {
      title: 'Check the fit',
      body: 'Each requirement is compared with the information you have confirmed. Unknowns stay visible.',
    },
    {
      title: 'See the real cost',
      body: 'Tuition, living, travel, accommodation and insurance are separated so “funded” has a useful meaning.',
    },
    {
      title: 'Build a plan',
      body: 'Get the documents, tasks and draft material in one place. Nothing changes until you approve it.',
    },
    {
      title: 'Keep your options organised',
      body: 'Save the opportunities that matter, track what is missing, and return to the next useful action.',
    },
  ];

  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-text">
            From “maybe” to a decision
          </h2>
          <p className="text-base leading-relaxed text-text-muted">
            The research is organised for you. The decision stays yours.
          </p>
        </div>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col gap-2 rounded-card border border-border p-5"
            >
              <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="text-card-title font-semibold text-text">{step.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingDifferentiation() {
  const concepts = [
    {
      term: 'Profile match',
      body: 'How well the programme fits you. Never a probability of admission.',
    },
    {
      term: 'Eligibility',
      body: 'Likely, unresolved or not met — against the clause in the call.',
    },
    { term: 'Funding', body: 'What is covered and what you would still have to pay.' },
    { term: 'Competition', body: 'Only when a source states it. Otherwise it stays unknown.' },
    { term: 'Confidence', body: 'How complete and reliable the supporting evidence is.' },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-text">
            Five things that are usually confused, kept apart
          </h2>
          <p className="text-base leading-relaxed text-text-muted">
            A single score tells you nothing. Oppulse reports what it knows, what it inferred and
            what it could not verify — separately, and with the source next to each claim.
          </p>

          <div className="flex flex-col gap-2">
            {concepts.map((concept) => (
              <div
                key={concept.term}
                className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3"
              >
                <span className="text-sm font-semibold text-text">{concept.term}</span>
                <span className="text-sm text-text-muted">{concept.body}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-text">Helios Research Fellowship</p>
            <Badge tone="success">Fully funded</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-button bg-surface-subtle p-3">
              <dt className="text-meta text-text-muted">Profile match</dt>
              <dd className="text-lg font-semibold text-text">92 / 100</dd>
            </div>
            <div className="rounded-button bg-surface-subtle p-3">
              <dt className="text-meta text-text-muted">Eligibility</dt>
              <dd className="text-lg font-semibold text-success">Likely</dd>
            </div>
            <div className="rounded-button bg-surface-subtle p-3">
              <dt className="text-meta text-text-muted">Competition</dt>
              <dd className="text-lg font-semibold text-text">Moderate</dd>
            </div>
            <div className="rounded-button bg-surface-subtle p-3">
              <dt className="text-meta text-text-muted">Confidence</dt>
              <dd className="text-lg font-semibold text-text">High</dd>
            </div>
          </dl>

          <p className="rounded-button bg-warning-surface p-3 text-sm text-warning">
            Two sources give different closing dates. Verification required.
          </p>

          <p className="text-meta text-text-muted">
            Every claim above links to the source it came from, with the page reference and the time
            it was retrieved.
          </p>
        </Card>
      </div>
    </section>
  );
}

export function LandingTwoWays() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-text">
            Two ways in, one workspace
          </h2>
          <p className="text-base leading-relaxed text-text-muted">
            Talk to Oppulse, or hand it your documents. Both end up in the same place: your
            opportunities, your evidence and your application.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card className="flex flex-col gap-3 p-6">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-button bg-primary/12 text-primary"
            >
              <MessageSquareText className="size-5" />
            </span>
            <h3 className="text-card-title font-semibold text-text">Talk to Oppulse</h3>
            <p className="text-sm leading-relaxed text-text-muted">
              For students who know what they want but not where to look. Describe it in your own
              words; Oppulse turns it into a focused search.
            </p>
            <p className="text-meta text-text-muted">
              It can draft letters, emails and recommendation requests — and always shows you what
              changed before you use it.
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-6">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-button bg-primary/12 text-primary"
            >
              <Upload className="size-5" />
            </span>
            <h3 className="text-card-title font-semibold text-text">Work from your materials</h3>
            <p className="text-sm leading-relaxed text-text-muted">
              For students who already have a CV and want to move fast. Oppulse reads your
              documents, extracts your experience and education, and proposes what it found.
            </p>
            <p className="text-meta text-text-muted">
              Nothing influences your applications until you confirm it — and you can exclude any
              document at any time.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function LandingFinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="border-t border-border bg-sidebar">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
        <BellRing aria-hidden="true" className="size-7 text-white/70" />
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-white">
          Stop reading calls. Start qualifying for them.
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-white/70">
          Tell Oppulse what you want, and it will tell you what you actually qualify for — with the
          evidence, and with the one thing to do next.
        </p>
        <Button size="lg" onClick={onStart} className="mt-2">
          Start with my goal
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <p className="text-meta text-white/50">
          Free to use. No card required. Your documents stay private.
        </p>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-meta text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Oppulse AI — clearer opportunities, stronger applications</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link to="/auth/sign-in" className="underline-offset-2 hover:underline">
            Sign in
          </Link>
          <Link to="/auth/sign-up" className="underline-offset-2 hover:underline">
            Create an account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
