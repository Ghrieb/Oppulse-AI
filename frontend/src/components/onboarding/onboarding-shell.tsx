import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Onboarding shell.
 *
 * Two columns on desktop: the agent's context on the left, the current step
 * on the right. On mobile they stack, with the step first so the user is
 * never looking at a column of context instead of the question.
 */
export function OnboardingShell({
  aside,
  children,
  className,
}: {
  aside: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn('grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-8', className)}>
      <div className="order-2 lg:sticky lg:top-8 lg:order-1 lg:self-start">{aside}</div>
      <div className="order-1 min-w-0 lg:order-2">{children}</div>
    </div>
  );
}
