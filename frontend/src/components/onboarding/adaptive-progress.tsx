import { Check, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/display';
import { cn } from '@/lib/cn';

/**
 * Adaptive progress.
 *
 * It states how many questions are left *and* how many were answered from
 * the confirmed profile, so the user can see the agent doing work instead
 * of asking them things they have already told it.
 */
export function AdaptiveProgress({
  answeredCount,
  totalCount,
  inferredCount,
  className,
}: {
  answeredCount: number;
  totalCount: number;
  inferredCount: number;
  className?: string | undefined;
}) {
  const remaining = Math.max(0, totalCount - answeredCount);
  const percent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-text">
          {remaining === 0 ? 'Almost there' : `Question ${answeredCount + 1} of ${totalCount}`}
        </p>
        <p className="text-meta text-text-muted">{remaining} left</p>
      </div>

      <Progress value={percent} label="Onboarding progress" />

      {inferredCount > 0 ? (
        <p className="flex items-start gap-1.5 text-meta text-text-muted">
          <Sparkles aria-hidden="true" className="mt-px size-3.5 shrink-0 text-primary" />
          <span>
            {inferredCount} question{inferredCount === 1 ? '' : 's'} answered from your confirmed
            profile — you can change {inferredCount === 1 ? 'it' : 'them'} later.
          </span>
        </p>
      ) : null}

      <ul className="flex flex-wrap gap-1.5">
        {Array.from({ length: totalCount }, (_, index) => {
          const isAnswered = index < answeredCount;
          return (
            <li
              key={index}
              className={cn(
                'grid size-5 place-items-center rounded-full border text-[10px] font-semibold',
                isAnswered
                  ? 'border-success/30 bg-success-surface text-success'
                  : 'border-border bg-surface text-text-muted',
              )}
            >
              {isAnswered ? <Check aria-hidden="true" className="size-3" /> : index + 1}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
