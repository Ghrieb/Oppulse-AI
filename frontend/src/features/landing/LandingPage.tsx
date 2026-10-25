import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LandingDifferentiation,
  LandingFinalCta,
  LandingFooter,
  LandingHero,
  LandingHowItWorks,
  LandingProblem,
  LandingTwoWays,
} from './sections';
import { useStartOnboarding } from '@/lib/hooks/use-start-onboarding';

/**
 * The public landing page.
 *
 * A visitor should understand what Oppulse does, and why they would trust
 * it, before being asked to register.
 */
export function LandingPage() {
  const start = useStartOnboarding();

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img
              src="/brand/oppulse-mark.svg"
              alt=""
              aria-hidden="true"
              className="size-9 shrink-0"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm leading-tight font-semibold text-text">
                Oppulse AI
              </span>
              <span className="hidden text-meta leading-tight text-text-muted sm:block">
                Clearer opportunities, stronger applications
              </span>
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth/sign-in" className="whitespace-nowrap">
                Sign in
              </Link>
            </Button>
            <Button size="sm" onClick={() => start()} className="whitespace-nowrap">
              <span className="hidden sm:inline">Start with my goal</span>
              <span className="sm:hidden">Start</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <LandingHero
          onStart={() => start('goal')}
          onUpload={() => start('materials')}
          onAnalyse={() => start('link')}
        />

        <LandingProblem />
        <LandingHowItWorks />
        <LandingDifferentiation />
        <LandingTwoWays />

        <LandingFinalCta onStart={() => start('goal')} />
      </main>

      <LandingFooter />
    </div>
  );
}
