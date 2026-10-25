import { Check, CircleAlert, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/display';
import type { ProfileCompleteness } from '@/lib/completeness';

/**
 * Profile completeness.
 *
 * It counts what the agent can *use*, not what has been typed: a fact the
 * student has not confirmed does not count. The summary is written in plain
 * language, and every missing fact says what it is holding up.
 */
export function ProfileCompletenessPanel({
  completeness,
  className,
}: {
  completeness: ProfileCompleteness;
  className?: string | undefined;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-4">
          <span
            role="img"
            aria-label={`Profile completeness: ${completeness.percent} percent. ${completeness.confirmed} of ${completeness.required} required facts confirmed.`}
            className="relative grid size-16 shrink-0 place-items-center"
          >
            <svg viewBox="0 0 36 36" className="size-16 -rotate-90" aria-hidden="true">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3.5"
                className="stroke-surface-subtle"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(completeness.percent / 100) * 97.4} 97.4`}
                className="stroke-primary"
              />
            </svg>
            <span aria-hidden="true" className="absolute text-sm font-semibold text-text">
              {completeness.percent}%
            </span>
          </span>

          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-semibold text-text">Profile completeness</span>
            <p className="text-sm leading-relaxed text-text-muted">{completeness.summary}</p>
          </div>
        </div>

        <Progress value={completeness.percent} label="Profile completeness" />

        {completeness.pending.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-meta font-medium text-warning">
              <CircleAlert aria-hidden="true" className="size-3.5" />
              Waiting for you
            </p>
            <ul className="flex flex-col gap-1.5">
              {completeness.pending.map((fact) => (
                <li key={fact.id} className="text-sm text-text">
                  <span className="font-medium">{fact.label}</span>
                  <span className="text-text-muted"> — {fact.value}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="sm" variant="outline" className="self-start">
              <Link to={`/profile?fact=${completeness.pending[0]?.id ?? ''}`}>
                <Check aria-hidden="true" className="size-4" />
                Review it now
              </Link>
            </Button>
          </div>
        ) : null}

        {completeness.missing.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-meta font-medium text-text-muted">
              <Upload aria-hidden="true" className="size-3.5" />
              Still missing
            </p>
            <ul className="flex flex-col gap-2">
              {completeness.missing.map((missing) => (
                <li key={missing.key} className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-text">{missing.label}</span>
                  <span className="text-meta text-text-muted">{missing.usedFor}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="sm" variant="outline" className="self-start">
              <Link to="/documents">
                <Upload aria-hidden="true" className="size-4" />
                Add it from a document
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
